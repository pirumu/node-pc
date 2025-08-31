import { CONDITION_TYPE, EVENT_TYPE } from '@common/constants';
import { CuLockRequest } from '@culock/dto';
import { LOCK_STATUS, ProtocolType } from '@culock/protocols';
import { CuResponse } from '@culock/protocols/cu';
import {
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  BinEntity,
  LoadcellEntity,
  ItemEntity,
  IssueHistoryEntity,
  ItemTypeEntity,
  TransactionEventEntity,
  ITEM_TYPE_CATEGORY,
  ConditionEntity,
} from '@dals/mongo/entities';
import { RefHelper } from '@dals/mongo/helpers';
import { PublisherService, Transport } from '@framework/publisher';
import { sleep } from '@framework/time/sleep';
import { EntityManager, Reference, CreateRequestContext, ObjectId } from '@mikro-orm/mongodb';
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

  public async process(transactionId: string): Promise<void> {
    const em = this._em.fork();
    const tx = await em.findOneOrFail(TransactionEntity, new ObjectId(transactionId));
    this._logger.log(`[${tx.id}] Transaction starting. Total steps: ${tx.executionSteps.length}`);

    tx.status = TransactionStatus.PROCESSING;
    await em.flush();
    await this._executeStep(em, tx);
  }

  public async handleStepSuccess(em: EntityManager, payload: { transactionId: string; stepId: string }): Promise<void> {
    const tx = await em.findOneOrFail(TransactionEntity, new ObjectId(payload.transactionId));
    this._logger.log(`[${tx.id}] Step ${payload.stepId} completed successfully.`);

    switch (tx.type) {
      case TransactionType.ISSUE:
        await this._processIssueHistoryOnIssueSuccess(em, tx, payload.stepId);
        break;
      case TransactionType.RETURN:
        await this._processDamageItemsOnReturnSuccess(em, tx, payload.stepId);
        await this._processIssueHistoryOnReturnSuccess(em, tx, payload.stepId);
        break;
    }

    await this._advanceToNextStep(em, tx, payload.stepId);
  }

  public async handleStepFail(em: EntityManager, payload: { transactionId: string; stepId: string; errors: string[] }): Promise<void> {
    const tx = await em.findOneOrFail(TransactionEntity, { id: payload.transactionId });
    this._logger.error(`[${tx.id}] Step ${payload.stepId} failed. Errors: ${payload.errors.join(', ')}`);

    tx.status = TransactionStatus.AWAITING_CORRECTION;
    tx.lastError = { stepId: payload.stepId, messages: payload.errors };
    await em.flush();
  }

  public async forceNextStep(em: EntityManager, transactionId: string): Promise<void> {
    const tx = await em.findOne(TransactionEntity, {
      _id: new ObjectId(transactionId),
      status: TransactionStatus.AWAITING_CORRECTION,
    });

    if (!tx) {
      return;
    }
    const errorStep = tx.executionSteps[tx.executionSteps.length - 1].stepId;
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

    const wasLockOpened = await this._attemptToOpenLockWithRetry(em, transaction, bin);

    if (wasLockOpened) {
      await this._triggerRealtimeServices(transaction, step);
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
    await this._publisher.publish(Transport.MQTT, EVENT_TYPE.LOCK.OPEN_FAIL, {
      binId: bin.id,
      attempt: attempt,
      totalAttempts: EXECUTION_CONFIG.MAX_LOCK_OPEN_ATTEMPTS,
    });
  }

  private async _triggerRealtimeServices(transaction: TransactionEntity, step: any): Promise<void> {
    const hardwareIds = new Set<number>([
      ...step.itemsToIssue.map((i: any) => i.loadcellHardwareId),
      ...step.itemsToReturn.map((i: any) => i.loadcellHardwareId),
      ...step.itemsToReplenish.map((i: any) => i.loadcellHardwareId),
      ...step.keepTrackItems.map((i: any) => i.loadcellHardwareId),
    ]);

    await this._publisher.publish(Transport.MQTT, EVENT_TYPE.LOADCELL.START_READING, { hardwareIds: [...hardwareIds] });

    await sleep(EXECUTION_CONFIG.LOADCELL_STABILIZATION_MS);

    await this._publisher.publish(Transport.MQTT, EVENT_TYPE.BIN.OPENED, {
      transactionId: transaction.id,
      binId: step.binId,
    });
  }

  private async _advanceToNextStep(em: EntityManager, transaction: TransactionEntity, completedStepId: string): Promise<void> {
    const nextStepIndex = transaction.executionSteps.findIndex((s) => s.stepId === completedStepId) + 1;
    if (nextStepIndex < transaction.executionSteps.length) {
      transaction.currentStepId = transaction.executionSteps[nextStepIndex].stepId;
      await em.flush();
      await this._executeStep(em, transaction);
    } else {
      await this._completeTransaction(em, transaction);
    }
  }

  private async _completeTransaction(em: EntityManager, transaction: TransactionEntity): Promise<void> {
    this._logger.log(`[${transaction.id}] All steps completed. Finalizing transaction.`);
    transaction.status = TransactionStatus.COMPLETED;
    transaction.completedAt = new Date();
    await em.flush();
    await this._publisher.publish(Transport.MQTT, EVENT_TYPE.PROCESS.TRANSACTION_COMPLETED, { transactionId: transaction.id });
  }

  private async _failTransaction(em: EntityManager, transaction: TransactionEntity, reason: string): Promise<void> {
    transaction.status = TransactionStatus.FAILED;
    transaction.lastError = { message: reason };
    transaction.completedAt = new Date();
    await em.flush();
    await this._publisher.publish(Transport.MQTT, EVENT_TYPE.PROCESS.TRANSACTION_FAILED, { transactionId: transaction.id, reason });
  }

  private async _processIssueHistoryOnIssueSuccess(
    em: EntityManager,
    transaction: TransactionEntity,
    completedStepId: string,
  ): Promise<void> {
    this._logger.log(`[${transaction.id}] Processing issue history for completed ISSUE step ${completedStepId}.`);
    const events = await em.find(
      TransactionEventEntity,
      { transaction: transaction.id, stepId: completedStepId },
      { populate: ['loadcell', 'loadcell.bin'] },
    );
    const nonTrackableTypes = (await em.find(ItemTypeEntity, { category: { $ne: ITEM_TYPE_CATEGORY.CONSUMABLE } })).map((it) => it.id);

    for (const event of events) {
      if (event.quantityChanged >= 0) {
        continue;
      }
      const item = await em.findOne(ItemEntity, { id: event.item.id });
      if (!item || nonTrackableTypes.includes(item.itemType.id)) {
        continue;
      }

      const issuedQty = -event.quantityChanged;
      const userRef = Reference.create(transaction.user);
      const itemRef = Reference.create(item);
      const loadcell = RefHelper.getRequired(event.loadcell, 'LoadcellEntity');
      const bin = RefHelper.getRequired(loadcell.bin, 'BinEntity');

      let issueHistory = await em.findOne(IssueHistoryEntity, { user: userRef, item: itemRef });
      if (issueHistory) {
        issueHistory.totalIssuedQuantity += issuedQty;
        const locationIndex = issueHistory.locations.findIndex((loc) => loc.loadcellId.toString() === event.loadcell.id.toString());
        if (locationIndex > -1) {
          issueHistory.locations[locationIndex].quantity += issuedQty;
        } else {
          issueHistory.locations.push({ binId: bin._id, loadcellId: loadcell._id, quantity: issuedQty });
        }
      } else {
        issueHistory = new IssueHistoryEntity({
          user: userRef,
          item: itemRef,
          totalIssuedQuantity: issuedQty,
          locations: [{ binId: bin._id, loadcellId: loadcell._id, quantity: issuedQty }],
        });
        this._em.persist(issueHistory);
      }
    }
    await em.flush();
  }

  private async _processDamageItemsOnReturnSuccess(
    em: EntityManager,
    transaction: TransactionEntity,
    completedStepId: string,
  ): Promise<void> {
    this._logger.log(`[${transaction.id}] Processing damage items for completed RETURN step ${completedStepId}.`);
    const step = transaction.currentStep(completedStepId);
    if (!step) {
      return;
    }

    const itemsWithCondition = step.itemsToReturn.filter((item) => !!item.conditionId);
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
      const loadcell = await em.findOne(LoadcellEntity, new ObjectId(plannedItem.loadcellId));
      if (loadcell) {
        loadcell.damageQuantity += actualReturnedQty;
        this._logger.log(
          `[${transaction.id}] Item ${plannedItem.name} returned as DAMAGED. Updating damage quantity for loadcell ${loadcell.id} by ${actualReturnedQty}.`,
        );
        if (loadcell.bin) {
          binsToMarkAsDamaged.add(loadcell.bin.id);
        }
      }
    }

    if (binsToMarkAsDamaged.size > 0) {
      this._logger.log(`[${transaction.id}] Marking bins as damaged: ${Array.from(binsToMarkAsDamaged).join(', ')}`);
      await em.nativeUpdate(BinEntity, { id: { $in: Array.from(binsToMarkAsDamaged) } }, { state: { isDamaged: true } });
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
        const locationIndex = issueHistory.locations.findIndex((loc) => loc.loadcellId.toString() === event.loadcell.id.toString());
        if (locationIndex > -1) {
          issueHistory.locations[locationIndex].quantity -= returnedQty;
          if (issueHistory.locations[locationIndex].quantity <= 0) {
            issueHistory.locations.splice(locationIndex, 1);
          }
        }
        if (issueHistory.totalIssuedQuantity <= 0) {
          this._logger.log(`[${transaction.id}] All issued items ${itemRef.id} have been returned. Removing history record.`);
          this._em.remove(issueHistory);
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
