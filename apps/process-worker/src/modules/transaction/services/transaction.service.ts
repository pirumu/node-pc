import { BinItemType, ExecutionStep } from '@common/business/types';
import { CONDITION_TYPE, EVENT_TYPE } from '@common/constants';
import { CuLockRequest } from '@culock/dto';
import { LOCK_STATUS, ProtocolType } from '@culock/protocols';
import { CuResponse } from '@culock/protocols/cu';
import {
  BinEntity,
  ConditionEntity,
  IssuedItemLocation,
  IssueHistoryEntity,
  ITEM_TYPE_CATEGORY,
  ItemTypeEntity,
  LoadcellEntity,
  TransactionEntity,
  TransactionEventEntity,
  TransactionStatus,
  TransactionType,
  TxExecutionStep,
} from '@dals/mongo/entities';
import { RefHelper } from '@dals/mongo/helpers';
import { PublisherService, Transport } from '@framework/publisher';
import { sleep } from '@framework/time/sleep';
import { EntityManager, ObjectId, Reference } from '@mikro-orm/mongodb';
import { Injectable, Logger } from '@nestjs/common';

// Constants for retry logic
const EXECUTION_CONFIG = {
  MAX_LOCK_OPEN_ATTEMPTS: 3,
  LOCK_RETRY_DELAY_MS: 2000,
  LOADCELL_STABILIZATION_MS: 1500,
};

@Injectable()
export class TransactionService {
  private readonly _logger = new Logger(TransactionService.name);

  constructor(
    private readonly _em: EntityManager,
    private readonly _publisher: PublisherService,
  ) {}

  public async process(transactionId: string): Promise<TransactionEntity> {
    const em = this._em.fork();
    const tx = await em.findOneOrFail(TransactionEntity, new ObjectId(transactionId));
    this._logger.log(`[${tx.id}] Transaction starting. Total steps: ${tx.executionSteps.length}`);

    tx.status = TransactionStatus.PROCESSING;
    await em.flush();
    await this._executeStep(em, tx);
    return tx;
  }

  public async handleStepSuccess(em: EntityManager, payload: { transactionId: string; stepId: string }): Promise<void> {
    const tx = await em.findOneOrFail(TransactionEntity, new ObjectId(payload.transactionId));
    this._logger.log(`[${tx.id}] Step ${payload.stepId} completed successfully.`);

    switch (tx.type) {
      case TransactionType.ISSUE:
        await Promise.allSettled([
          this._processQuantityNormalItemOnSuccess(em, tx, payload.stepId),
          this._processIssueHistoryOnIssueSuccess(em, tx, payload.stepId),
        ]);
        break;
      case TransactionType.RETURN:
        await Promise.allSettled([
          this._processQuantityNormalItemOnSuccess(em, tx, payload.stepId),
          this._processIssueHistoryOnReturnSuccess(em, tx, payload.stepId),
          this._processDamageItemsOnReturnSuccess(em, tx, payload.stepId),
        ]);
        break;
    }
    const completedStep = tx.currentStep(payload.stepId);
    if (completedStep) {
      await this._handleLockedBinUpdateByStep(em, tx.id, completedStep);
    }

    await this._advanceToNextStep(em, tx, payload.stepId, false);
  }

  public async handleTxComplete(em: EntityManager, payload: { transactionId: string }): Promise<void> {
    const tx = await em.findOneOrFail(TransactionEntity, new ObjectId(payload.transactionId));
    this._logger.log(`TX [${tx.id}]  completed successfully.`);

    try {
      for (const step of tx.executionSteps) {
        await this._stopRealtimeServices(tx, step.stepId);
      }
    } catch (error) {
      this._logger.warn('_stopRealtimeServices error', error);
    }
    await this._handleLockedBinUpdate(em, tx);
  }

  /**
   * Back up when loadcell stopped before commit pending change.
   * @see apps/process-worker/src/modules/loadcell/loadcell.service.ts _handleLockedBinUpdate
   */
  private async _handleLockedBinUpdate(em: EntityManager, tx: TransactionEntity): Promise<void> {
    const loadcellIdStrings = tx.executionSteps.flatMap((step) => [
      ...step.itemsToIssue.map((i) => i.loadcellId),
      ...step.itemsToReturn.map((i) => i.loadcellId),
      ...step.itemsToReplenish.map((i) => i.loadcellId),
      ...step.keepTrackItems.map((i) => i.loadcellId),
    ]);
    const uniqueLoadcellIds = [...new Set(loadcellIdStrings)].filter((id) => id !== 'N/A').map((id) => new ObjectId(id));

    if (uniqueLoadcellIds.length === 0) {
      this._logger.log(`[Tx ${tx.id}] No loadcells to update for transaction ${tx.id}.`);
      return;
    }

    this._logger.log(`[Tx ${tx.id}]] Preparing bulk update for ${uniqueLoadcellIds.length} loadcells in transaction ${tx.id}.`);
    const loadcellsToUpdate = await em.find(
      LoadcellEntity,
      {
        _id: { $in: uniqueLoadcellIds },
      },
      { populate: ['bin'] },
    );

    const bulkOperations = [];

    for (const loadcell of loadcellsToUpdate) {
      const pendingChange = loadcell.liveReading.pendingChange;
      if (pendingChange !== 0) {
        bulkOperations.push({
          updateOne: {
            filter: { _id: loadcell._id },
            update: {
              $inc: { availableQuantity: pendingChange },
              $set: {
                ['liveReading.pendingChange']: 0,
                ['synchronization.localToCloud.isSynced']: false,
                updatedAt: new Date(),
              },
            },
          },
        });
      }
    }

    if (bulkOperations.length === 0) {
      Logger.log(`[Tx ${tx.id}]] No actual changes to apply to loadcells for transaction ${tx.id}.`);
      return;
    }
    try {
      const loadcellCollection = em.getCollection(LoadcellEntity);

      const result = await loadcellCollection.bulkWrite(bulkOperations);

      Logger.log(
        `[Tx ${tx.id}]] Bulk update completed for transaction ${tx.id}. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}.`,
      );
    } catch (error) {
      Logger.error(`[Tx ${tx.id}]] Failed to perform bulk update for transaction ${tx.id}.`, error);
    }
  }

  /**
   * Back up when loadcell stopped before commit pending change.
   * @see apps/process-worker/src/modules/loadcell/loadcell.service.ts _handleLockedBinUpdate
   */
  private async _handleLockedBinUpdateByStep(em: EntityManager, txId: string, step: TxExecutionStep): Promise<void> {
    const loadcellIdStrings = [
      ...step.itemsToIssue.map((i) => i.loadcellId),
      ...step.itemsToReturn.map((i) => i.loadcellId),
      ...step.itemsToReplenish.map((i) => i.loadcellId),
      ...step.keepTrackItems.map((i) => i.loadcellId),
    ];
    const uniqueLoadcellIds = [...new Set(loadcellIdStrings)].filter((id) => id !== 'N/A').map((id) => new ObjectId(id));

    if (uniqueLoadcellIds.length === 0) {
      this._logger.log(`[Tx ${txId}] No loadcells to update for transaction ${txId}.`);
      return;
    }

    this._logger.log(`[Tx ${txId}]] Preparing bulk update for ${uniqueLoadcellIds.length} loadcells in transaction ${txId}.`);
    const loadcellsToUpdate = await em.find(
      LoadcellEntity,
      {
        _id: { $in: uniqueLoadcellIds },
      },
      { populate: ['bin'] },
    );

    const bulkOperations = [];

    for (const loadcell of loadcellsToUpdate) {
      const pendingChange = loadcell.liveReading.pendingChange;
      if (pendingChange !== 0) {
        bulkOperations.push({
          updateOne: {
            filter: { _id: loadcell._id },
            update: {
              $inc: { availableQuantity: pendingChange },
              $set: {
                ['liveReading.pendingChange']: 0,
                ['synchronization.localToCloud.isSynced']: false,
                updatedAt: new Date(),
              },
            },
          },
        });
      }
    }

    if (bulkOperations.length === 0) {
      Logger.log(`[Tx ${txId}]] No actual changes to apply to loadcells for transaction ${txId}.`);
      return;
    }
    try {
      const loadcellCollection = em.getCollection(LoadcellEntity);

      const result = await loadcellCollection.bulkWrite(bulkOperations);

      Logger.log(
        `[Tx ${txId}]] Bulk update completed for transaction ${txId}. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}.`,
      );
    } catch (error) {
      Logger.error(`[Tx ${txId}]] Failed to perform bulk update for transaction ${txId}.`, error);
    }
  }

  public async handleTxError(em: EntityManager, payload: { transactionId: string }): Promise<void> {
    const tx = await em.findOneOrFail(TransactionEntity, new ObjectId(payload.transactionId));
    this._logger.log(`TX [${tx.id}]  completed error.`);
    try {
      for (const step of tx.executionSteps) {
        await this._stopRealtimeServices(tx, step.stepId);
      }
    } catch (error) {
      this._logger.warn('_stopRealtimeServices error', error);
    }
  }

  private async _stopRealtimeServices(tx: TransactionEntity, stepId: string): Promise<void> {
    const step = tx.currentStep(stepId);
    if (!step) {
      return;
    }
    const hardwareIds = new Set<number>([
      ...step.itemsToIssue.map((i) => i.loadcellHardwareId),
      ...step.itemsToReturn.map((i) => i.loadcellHardwareId),
      ...step.itemsToReplenish.map((i) => i.loadcellHardwareId),
      ...step.keepTrackItems.map((i) => i.loadcellHardwareId),
    ]);

    await this._publisher.publish(Transport.MQTT, EVENT_TYPE.LOADCELL.STOP_READING, { hardwareIds: [...hardwareIds] }, {}, { async: true });
  }

  public async handleStepFail(em: EntityManager, payload: { transactionId: string; stepId: string; errors: string[] }): Promise<void> {
    const tx = await em.findOneOrFail(TransactionEntity, new ObjectId(payload.transactionId));
    this._logger.error(`[${tx.id}] Step ${payload.stepId} failed. `, payload);

    await em.nativeUpdate(
      TransactionEntity,
      {
        _id: tx._id,
      },
      {
        status: TransactionStatus.AWAITING_CORRECTION,
        lastError: { stepId: payload.stepId, messages: payload.errors },
      },
    );

    await this._publisher.publish(Transport.MQTT, EVENT_TYPE.PROCESS.STEP_ERROR, { transactionId: tx.id }, {}, { async: true });
  }

  public async forceNextStep(em: EntityManager, transactionId: string, next: boolean): Promise<any> {
    const tx = await em.findOne(TransactionEntity, {
      _id: new ObjectId(transactionId),
      status: TransactionStatus.AWAITING_CORRECTION,
    });

    if (!tx) {
      return;
    }
    if (next) {
      const currentStepError = tx.lastError?.stepId;
      if (currentStepError) {
        return this._advanceToNextStep(em, tx, currentStepError, true);
      }
    }

    return this.process(tx.id);
  }

  private async _executeStep(em: EntityManager, transaction: TransactionEntity): Promise<void> {
    const step = transaction.currentStep(transaction.currentStepId);
    if (!step) {
      this._logger.error(`[${transaction.id}] Cannot find step with ID: ${transaction.currentStepId}. Failing transaction.`);
      await this._failTransaction(em, transaction, 'Invalid step ID.');
      return;
    }

    this._logger.log(`[${transaction.id}] Executing step ${step.stepId} for bin ${step.binId}.`);
    const bin = await em.findOne(BinEntity, new ObjectId(step.binId));

    if (!bin || bin.state.isFailed) {
      this._logger.warn(`[${transaction.id}] Bin ${step.binId} is marked as failed. Skipping step.`);
      await this.handleStepSuccess(em, { transactionId: transaction.id, stepId: step.stepId });
      return;
    }

    const items = [...step.itemsToIssue, ...step.itemsToReturn, ...step.itemsToReplenish];
    const keepTrackItems = step.keepTrackItems;
    const instructions = step.instructions;

    sleep(1000).then(async () => {
      return this._publisher.publish(
        Transport.MQTT,
        EVENT_TYPE.PROCESS.STEP_START,
        {
          isFinal: transaction.isLastStep(step.stepId),
          transactionId: transaction.id,
          label: `${step.location.cabinetName}/${step.location.binName}`,
          type: transaction.type,
          items: items,
          keepTrackItems: keepTrackItems,
          instructions: instructions,
        },
        {},
        { async: true },
      );
    });

    const wasLockOpened = await this._attemptToOpenLockWithRetry(em, transaction, bin);

    if (wasLockOpened) {
      const stepItems = [...step.itemsToIssue, ...step.itemsToReturn, ...step.itemsToReplenish, ...step.keepTrackItems];

      // because the bin cannot contain both loadcell and normal items.
      const isProcessLoadcellItem = stepItems.every((i) => i.binItemType === BinItemType.LOADCELL);

      if (isProcessLoadcellItem) {
        await this._triggerRealtimeServices(step);
        // wait for loadcell stable
        await sleep(EXECUTION_CONFIG.LOADCELL_STABILIZATION_MS);
      }

      await this._publisher.publish(
        Transport.MQTT,
        EVENT_TYPE.BIN.OPENED,
        {
          transactionId: transaction.id,
          binId: step.binId,
        },
        {},
        { async: true },
      );
    }
  }

  private async _attemptToOpenLockWithRetry(em: EntityManager, transaction: TransactionEntity, bin: BinEntity): Promise<boolean> {
    for (let attempt = 1; attempt <= EXECUTION_CONFIG.MAX_LOCK_OPEN_ATTEMPTS; attempt++) {
      this._logger.log(`[${transaction.id}] Attempt ${attempt}/${EXECUTION_CONFIG.MAX_LOCK_OPEN_ATTEMPTS} to open bin ${bin.id}.`);

      try {
        const response = await this._publisher.publish<CuResponse>(
          Transport.TCP,
          EVENT_TYPE.LOCK.OPEN,
          new CuLockRequest({
            deviceId: bin.cuLockId,
            lockIds: [bin.lockId],
            protocol: ProtocolType.CU,
          }),
        );

        if (response.isSuccess && Object.values(response.lockStatuses).every((s) => s === LOCK_STATUS.OPENED)) {
          this._logger.log(`[${transaction.id}] Bin ${bin.id} opened successfully.`);
          bin.state.isLocked = false;
          bin.state.failedOpenAttempts = 0;
          await em.flush();
          return true;
        }

        this._logger.warn(`[${transaction.id}] Open lock command failed for bin ${bin.id} on attempt ${attempt}.`);
        await this._handleLockOpenFailure(em, bin, attempt);
      } catch (error) {
        this._logger.error(`[${transaction.id}] Network/service error on attempt ${attempt} for bin ${bin.id}:`, error);
        await this._handleLockOpenFailure(em, bin, attempt);
      }

      if (attempt < EXECUTION_CONFIG.MAX_LOCK_OPEN_ATTEMPTS) {
        await sleep(EXECUTION_CONFIG.LOCK_RETRY_DELAY_MS);
      }
    }

    this._logger.error(`[${transaction.id}] All ${EXECUTION_CONFIG.MAX_LOCK_OPEN_ATTEMPTS} attempts to open bin ${bin.id} have failed.`);
    bin.state.isFailed = true;
    await em.flush();
    await this.handleStepFail(em, {
      transactionId: transaction.id,
      stepId: transaction.currentStepId,
      errors: [`Failed to open bin lock after ${EXECUTION_CONFIG.MAX_LOCK_OPEN_ATTEMPTS} attempts.`],
    });
    return false;
  }

  private async _handleLockOpenFailure(em: EntityManager, bin: BinEntity, attempt: number): Promise<void> {
    bin.state.failedOpenAttempts = (bin.state.failedOpenAttempts || 0) + 1;
    await em.flush();
    await this._publisher.publish(
      Transport.MQTT,
      EVENT_TYPE.LOCK.OPEN_FAIL,
      {
        binId: bin.id,
        attempt: attempt,
        totalAttempts: EXECUTION_CONFIG.MAX_LOCK_OPEN_ATTEMPTS,
      },
      {},
      { async: true },
    );
  }

  private async _triggerRealtimeServices(step: TxExecutionStep): Promise<void> {
    const hardwareIds = new Set<number>([
      ...step.itemsToIssue.map((i) => i.loadcellHardwareId),
      ...step.itemsToReturn.map((i) => i.loadcellHardwareId),
      ...step.itemsToReplenish.map((i) => i.loadcellHardwareId),
      ...step.keepTrackItems.map((i) => i.loadcellHardwareId),
    ]);

    return this._publisher.publish(
      Transport.MQTT,
      EVENT_TYPE.LOADCELL.START_READING,
      { hardwareIds: [...hardwareIds] },
      {},
      { async: true },
    );
  }

  private async _advanceToNextStep(
    em: EntityManager,
    transaction: TransactionEntity,
    completedStepId: string,
    fromErrorStep: boolean,
  ): Promise<void> {
    const nextStepIndex = transaction.executionSteps.findIndex((s) => s.stepId === completedStepId) + 1;
    if (nextStepIndex < transaction.executionSteps.length) {
      transaction.currentStepId = transaction.executionSteps[nextStepIndex].stepId;
      await em.flush();
      await this._executeStep(em, transaction);
    } else {
      await this._completeTransaction(em, transaction, fromErrorStep);
    }
  }

  private async _completeTransaction(em: EntityManager, transaction: TransactionEntity, isError: boolean): Promise<void> {
    this._logger.log(`[${transaction.id}] All steps completed. Finalizing transaction.`);
    transaction.status = isError ? TransactionStatus.COMPLETED_WITH_ERROR : TransactionStatus.COMPLETED;
    transaction.completedAt = new Date();
    await em.flush();
    await this._publisher.publish(
      Transport.MQTT,
      EVENT_TYPE.PROCESS.TRANSACTION_COMPLETED,
      { transactionId: transaction.id },
      {},
      { async: true },
    );
  }

  private async _failTransaction(em: EntityManager, transaction: TransactionEntity, reason: string): Promise<void> {
    transaction.status = TransactionStatus.FAILED;
    transaction.lastError = { message: reason };
    transaction.completedAt = new Date();
    await em.flush();
    await this._publisher.publish(
      Transport.MQTT,
      EVENT_TYPE.PROCESS.TRANSACTION_FAILED,
      { transactionId: transaction.id, reason },
      {},
      { async: true },
    );
  }

  private async _processQuantityNormalItemOnSuccess(em: EntityManager, transaction: TransactionEntity, completedStepId: string) {
    this._logger.log(`[${transaction.id}] Processing update normal item qty for completed step ${completedStepId}.`);
    const events = await em.find(
      TransactionEventEntity,
      { transaction: new ObjectId(transaction.id), stepId: completedStepId },
      { populate: ['loadcell', 'bin', 'item'] },
    );
    for (const event of events) {
      const item = RefHelper.get(event.item);
      const loadcell = RefHelper.get(event.loadcell);
      const bin = RefHelper.get(event.bin);
      if (!bin || !item || loadcell) {
        continue;
      }

      bin.items = bin.items.map((i) => {
        if (i.itemId.equals(item._id)) {
          i.qty += event.quantityChanged;
        }
        return i;
      });
      em.persist(bin);
    }
    await em.flush();
  }

  private async _processIssueHistoryOnIssueSuccess(
    em: EntityManager,
    transaction: TransactionEntity,
    completedStepId: string,
  ): Promise<void> {
    this._logger.log(`[${transaction.id}] Processing issue history for completed ISSUE step ${completedStepId}.`);
    const events = await em.find(
      TransactionEventEntity,
      { transaction: new ObjectId(transaction.id), stepId: completedStepId },
      { populate: ['loadcell', 'bin', 'item'] },
    );
    const trackableTypes = (await em.find(ItemTypeEntity, { category: { $ne: ITEM_TYPE_CATEGORY.CONSUMABLE } })).map((it) => it.id);

    for (const event of events) {
      if (event.quantityChanged >= 0) {
        continue;
      }

      const item = RefHelper.get(event.item);
      if (!item || !trackableTypes.includes(item.itemType.id)) {
        continue;
      }

      const issuedQty = Math.abs(event.quantityChanged);
      const userRef = Reference.create(transaction.user);
      const itemRef = Reference.create(item);
      const loadcell = RefHelper.get(event.loadcell);
      const bin = RefHelper.getRequired(event.bin, 'BinEntity');

      let issueHistory = await em.findOne(IssueHistoryEntity, { user: userRef, item: itemRef });
      if (issueHistory) {
        issueHistory.totalIssuedQuantity += issuedQty;
        const locationIndex = issueHistory.locations.findIndex((loc) => {
          if (loc.loadcellId) {
            return loc.loadcellId.toString() === event.loadcell?.id;
          }
          return loc.binId.toString() === event.bin.id;
        });
        if (locationIndex > -1) {
          issueHistory.locations[locationIndex].quantity += issuedQty;
        } else {
          issueHistory.locations.push(new IssuedItemLocation({ binId: bin._id, loadcellId: loadcell?._id || null, quantity: issuedQty }));
        }
      } else {
        issueHistory = new IssueHistoryEntity({
          user: userRef,
          item: itemRef,
          totalIssuedQuantity: issuedQty,
          locations: [new IssuedItemLocation({ binId: bin._id, loadcellId: loadcell?._id || null, quantity: issuedQty })],
        });
        em.persist(issueHistory);
      }
    }
    await em.flush();
  }

  private async _processDamageItemsOnReturnSuccess(
    em: EntityManager,
    transaction: TransactionEntity,
    completedStepId: string,
  ): Promise<void> {
    this._logger.log(`[tx ${transaction.id}] Processing damage items for completed RETURN step ${completedStepId}.`);
    const step = transaction.currentStep(completedStepId);
    if (!step) {
      return;
    }
    const itemsWithCondition = step.itemsToReturn.filter((item) => !!item.conditionId);
    this._logger.log(`[tx ${transaction.id}] Processing damage items for completed RETURN step ${completedStepId}.`, itemsWithCondition);

    if (itemsWithCondition.length === 0) {
      return;
    }

    const conditionIds = itemsWithCondition.map((item) => new ObjectId(item.conditionId));
    const conditions = await em.find(ConditionEntity, { _id: { $in: conditionIds } });
    const conditionMap = new Map<string, CONDITION_TYPE>();
    conditions.forEach((c) => conditionMap.set(c.id, c.name));

    const events = await em.find(TransactionEventEntity, { transaction: new ObjectId(transaction.id), stepId: completedStepId });
    const binsToMarkAsDamaged = new Set<string>();

    for (const plannedItem of itemsWithCondition) {
      const conditionName = conditionMap.get(plannedItem.conditionId || 'unknown');
      if (conditionName !== CONDITION_TYPE.DAMAGE) {
        continue;
      }

      const event = events.find((e) => e.item.id === plannedItem.itemId);
      if (!event || event.quantityChanged <= 0) {
        continue;
      }

      const actualReturnedQty = event.quantityChanged;
      // loadcell item.
      if (plannedItem.loadcellId !== 'N/A') {
        const loadcell = await em.findOne(LoadcellEntity, new ObjectId(plannedItem.loadcellId), { populate: ['bin'] });
        if (loadcell) {
          if (loadcell.damageQuantity === undefined || loadcell.damageQuantity === null || isNaN(loadcell.damageQuantity)) {
            loadcell.damageQuantity = 0;
          }
          loadcell.damageQuantity += actualReturnedQty;
          this._logger.log(
            `[${transaction.id}] Item ${plannedItem.name} returned as DAMAGED. Updating damage quantity for loadcell ${loadcell.id} by ${actualReturnedQty}.`,
          );
          if (loadcell.bin) {
            binsToMarkAsDamaged.add(loadcell.bin.id);
          }
        }
      } else {
        const bin = await em.findOne(BinEntity, new ObjectId(plannedItem.binId));
        if (bin) {
          bin.items = bin.items.map((i) => {
            if (i.itemId.equals(event.item._id)) {
              if (i.damageQuantity === undefined || i.damageQuantity === null || isNaN(i.damageQuantity)) {
                i.damageQuantity = 0;
              }
              i.damageQuantity += actualReturnedQty;
            }
            return i;
          });
          binsToMarkAsDamaged.add(bin.id);
        }
      }
    }

    if (binsToMarkAsDamaged.size > 0) {
      this._logger.log(`[${transaction.id}] Marking bins as damaged: ${Array.from(binsToMarkAsDamaged).join(', ')}`);
      await em.nativeUpdate(
        BinEntity,
        { _id: { $in: Array.from(binsToMarkAsDamaged).map((id) => new ObjectId(id)) } },
        { ['state.isDamaged' as any]: true },
      );
    }
    await em.flush();
  }

  private async _processIssueHistoryOnReturnSuccess(
    em: EntityManager,
    transaction: TransactionEntity,
    completedStepId: string,
  ): Promise<void> {
    this._logger.log(`[${transaction.id}] Processing issue history for completed RETURN step ${completedStepId}.`);
    const events = await em.find(TransactionEventEntity, { transaction: transaction._id, stepId: completedStepId });

    for (const event of events) {
      if (event.quantityChanged <= 0) {
        continue;
      }
      const returnedQty = event.quantityChanged;
      const userRef = Reference.create(transaction.user);
      const itemRef = Reference.create(event.item);
      const issueHistory = await em.findOne(IssueHistoryEntity, { user: userRef, item: itemRef });

      if (issueHistory) {
        this._logger.log(
          `[${transaction.id}] User returned ${returnedQty} of item ${itemRef.id}. Previous outstanding: ${issueHistory.totalIssuedQuantity}.`,
        );
        issueHistory.totalIssuedQuantity -= returnedQty;
        const locationIndex = event.loadcell
          ? issueHistory.locations.findIndex((loc) => loc.loadcellId?.toString() === event.loadcell?.id)
          : issueHistory.locations.findIndex((loc) => loc.binId.toString() === event.bin.id);

        if (locationIndex > -1) {
          issueHistory.locations[locationIndex].quantity -= returnedQty;
          if (issueHistory.locations[locationIndex].quantity <= 0) {
            issueHistory.locations.splice(locationIndex, 1);
          }
        }
        if (issueHistory.totalIssuedQuantity <= 0) {
          this._logger.log(`[${transaction.id}] All issued items ${itemRef.id} have been returned. Removing history record.`);
          em.remove(issueHistory);
        } else {
          this._logger.log(`[${transaction.id}] Remaining outstanding for item ${itemRef.id} is ${issueHistory.totalIssuedQuantity}.`);
        }
      } else {
        this._logger.warn(`[${transaction.id}] User returned item ${itemRef.id} for which no issue history was found.`);
      }
    }
    await em.flush();
  }
}
