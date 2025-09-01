import { ExecutionStep, ItemToTake, ItemToReturn, AnotherItem } from '@common/business/types';
import { EVENT_TYPE, ProcessEventType } from '@common/constants';
import { CuLockRequest } from '@culock/dto';
import { LOCK_STATUS, ProtocolType } from '@culock/protocols';
import { CuResponse } from '@culock/protocols/cu';
import {
  BinEntity,
  LoadcellEntity,
  Synchronization,
  TransactionEntity,
  TransactionEventEntity,
  TransactionType,
} from '@dals/mongo/entities';
import { PublisherService, Transport } from '@framework/publisher';
import { Nullable } from '@framework/types';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { MongoEntityManager, ObjectId } from '@mikro-orm/mongodb';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

const WEIGHT_POLLING_INTERVAL_MS = 1000;
const LOCK_POLLING_INTERVAL_MS = 1000;

export enum PlanActionType {
  ISSUE = 'issue',
  RETURN = 'return',
  REPLENISH = 'replenish',
  KEEP_TRACK = 'keepTrack',
}

export type PollingContext = {
  intervalId: NodeJS.Timeout;
  step: ExecutionStep;
  initialQuantities: Map<string, number>;
  lastSentMessages: Map<string, string>;
};

export type LockPollingContext = Omit<PollingContext, 'lastSentMessages' | 'initialQuantities'>;

export type StepCalculationResult = {
  isValid: boolean;
  events: TransactionEventEntity[];
  errorMessages: string[];
};

export type PlannedActionResult = {
  type: PlanActionType;
  item: ItemToTake | ItemToReturn | (AnotherItem & { requestQty: number });
};

@Injectable()
export class QuantityCheckingService implements OnModuleDestroy {
  private readonly _logger = new Logger(QuantityCheckingService.name);
  private _activePollingLockStatusLoops = new Map<string, LockPollingContext>();

  constructor(
    private readonly _orm: MikroORM,
    private readonly _publisher: PublisherService,
  ) {}

  public onModuleDestroy(): void {
    this._activePollingLockStatusLoops.forEach((context, txId) => {
      this._logger.warn(`[${txId}] Forcibly stopping lock polling loop due to module destruction.`);
      clearInterval(context.intervalId);
    });
    this._activePollingLockStatusLoops.clear();
  }

  public async handleBinOpened(event: { transactionId: string; binId: string }): Promise<void> {
    return RequestContext.create(this._orm.em, async () => {
      const em = RequestContext.getEntityManager()!;
      const { transactionId, binId } = event;

      this._stopLockPolling(transactionId);

      this._logger.log(`[${transactionId}] Bin ${binId} opened. Starting real-time DB polling.`);

      const tx = await em.findOneOrFail(TransactionEntity, new ObjectId(transactionId));
      const step = tx.currentStep(tx.currentStepId);

      if (!step || step.binId !== binId) {
        return;
      }

      // start keep track bin lock status.
      const lockStatusIntervalId = setInterval(async () => this._lockStatusPollingCycle(em, transactionId), LOCK_POLLING_INTERVAL_MS);
      this._activePollingLockStatusLoops.set(transactionId, {
        intervalId: lockStatusIntervalId,
        step: step as any, // stupid TypeScript
      });

      const loadcells = await em.find(LoadcellEntity, {
        bin: new ObjectId(binId),
        item: { $ne: null },
      });

      const initialQuantities = new Map<string, number>();

      loadcells.forEach((lc) => {
        initialQuantities.set(lc.id, lc.availableQuantity);
      });

      await this._publisher.publish(
        Transport.MQTT,
        EVENT_TYPE.PROCESS.INSTRUCTION,
        {
          transactionId,
          instructions: step.instructions,
        },
        {},
        { async: true },
      );
    });
  }

  public async handleBinClosed(event: { transactionId: string; binId: string }): Promise<void> {
    return RequestContext.create(this._orm.em, async () => {
      const { transactionId, binId } = event;
      const em = RequestContext.getEntityManager()! as MongoEntityManager;
      this._stopLockPolling(transactionId);

      this._logger.log(`[${transactionId}] Bin ${binId} closed. Persisting final results.`);

      const tx = await em.findOneOrFail(TransactionEntity, new ObjectId(transactionId));

      const step = tx.currentStep(tx.currentStepId);
      if (!step || step.binId !== binId) {
        return;
      }

      const finalLoadcells = await em.find(LoadcellEntity, {
        bin: new ObjectId(binId),
        item: { $ne: null },
      });

      const result = this._calculateFinalStepResult(em, step as any, finalLoadcells);
      if (result.events.length > 0) {
        const events = result.events.map((e) => {
          return {
            transactionId: tx._id,
            itemId: e.item._id,
            loadcell: e.loadcell._id,
            stepId: e.stepId,
            output: e.output,
            quantityBefore: e.quantityBefore,
            quantityAfter: e.quantityAfter,
            quantityChanged: e.quantityChanged,
            synchronization: new Synchronization(),
          };
        });
        await em.getDriver().nativeInsertMany('transaction_events', events);
      }
      const eventType = result.isValid ? this._getSuccessTopic(tx.type) : this._getErrorTopic(tx.type);
      const internalEventType = result.isValid ? EVENT_TYPE.PROCESS.STEP_SUCCESS : EVENT_TYPE.PROCESS.STEP_ERROR;
      await Promise.all([
        this._publisher.publish(
          Transport.MQTT,
          eventType,
          {
            transactionId,
            stepId: step.stepId,
            errors: result.errorMessages,
          },
          {},
          { async: true },
        ),
        this._publisher.publish(
          Transport.MQTT,
          internalEventType,
          {
            transactionId,
            stepId: step.stepId,
            errors: result.errorMessages,
          },
          {},
          { async: true },
        ),
      ]);
    });
  }

  private async _lockStatusPollingCycle(em: any, transactionId: string): Promise<void> {
    const context = this._activePollingLockStatusLoops.get(transactionId);
    if (!context) {
      this._stopLockPolling(transactionId);
      return;
    }
    const { step } = context;

    const bin: BinEntity = await em.findOneOrFail(BinEntity, new ObjectId(step.binId), {
      cache: true,
    });

    const status = await this._publisher.publish<CuResponse>(
      Transport.TCP,
      EVENT_TYPE.LOCK.STATUS,
      new CuLockRequest({
        deviceId: bin.cuLockId,
        lockIds: [bin.lockId],
        protocol: ProtocolType.CU,
      }),
    );

    if (status.isSuccess && Object.values(status.lockStatuses).every((s) => s === LOCK_STATUS.CLOSED)) {
      bin.state.isLocked = true;
      await em.nativeUpdate(BinEntity, { _id: bin._id }, { ['state.isLocked']: true });
      await this._publisher.publish(
        Transport.MQTT,
        EVENT_TYPE.BIN.CLOSED,
        {
          transactionId,
          binId: step.binId,
        },
        {},
        { async: true },
      );
    }
  }

  private _stopLockPolling(transactionId: string): void {
    if (this._activePollingLockStatusLoops.has(transactionId)) {
      clearInterval(this._activePollingLockStatusLoops.get(transactionId)!.intervalId);
      this._activePollingLockStatusLoops.delete(transactionId);
      this._logger.log(`[${transactionId}] Lock Polling loop stopped.`);
    }
  }

  private _calculateFinalStepResult(em: any, step: ExecutionStep, finalLoadcells: LoadcellEntity[]): StepCalculationResult {
    const result: StepCalculationResult = {
      isValid: true,
      events: [],
      errorMessages: [],
    };

    const allPlannedActions = this._getAllPlannedActions(step);

    for (const index in allPlannedActions) {
      const plannedAction = allPlannedActions[index];
      const loadcell = finalLoadcells.find((lc) => lc.id === plannedAction.item.loadcellId);
      if (!loadcell) {
        result.isValid = false;
        result.errorMessages.push(`Loadcell for item ${plannedAction.item.itemId} not found.`);
        continue;
      }

      const quantityBefore = plannedAction.item.currentQty;
      const quantityAfter = loadcell.availableQuantity + loadcell.liveReading.pendingChange;
      const quantityChanged = quantityAfter - quantityBefore;

      if (plannedAction.type !== PlanActionType.KEEP_TRACK && quantityChanged === 0) {
        result.isValid = false;
        result.errorMessages.push(`No action was taken for item ${plannedAction.item.name}.`);
      }

      const validationError = this._validateChange(quantityChanged, plannedAction);
      if (validationError) {
        result.isValid = false;
        result.errorMessages.push(validationError);
      }

      const transactionEvent = new TransactionEventEntity({
        quantityBefore,
        quantityAfter,
        quantityChanged,
        stepId: step.stepId,
        output: {
          isValid: result.isValid,
          errorMessage: result.errorMessages[index],
        },
      });
      em.assign(transactionEvent, {
        loadcell: loadcell,
        item: loadcell.item!,
      });
      result.events.push(transactionEvent);
    }
    return result;
  }

  private _calculateCurrentQuantityFromWeight(loadcell: LoadcellEntity): number {
    const { liveReading, calibration } = loadcell;
    if (!calibration.unitWeight || calibration.unitWeight === 0) {
      this._logger.warn(`[LC-${loadcell.code}] Unit weight is zero. Cannot calculate quantity.`);
      return loadcell.availableQuantity;
    }
    const netWeight = liveReading.currentWeight - calibration.zeroWeight;
    return Math.round(netWeight / calibration.unitWeight);
  }

  private _getAllPlannedActions(step: ExecutionStep) {
    return [
      ...step.itemsToIssue.map((item) => ({ type: PlanActionType.ISSUE, item })),
      ...step.itemsToReturn.map((item) => ({ type: PlanActionType.RETURN, item })),
      ...step.itemsToReplenish.map((item) => ({ type: PlanActionType.REPLENISH, item })),
      ...step.keepTrackItems.map((item) => ({
        type: PlanActionType.KEEP_TRACK,
        item: { ...item, requestQty: 0 },
      })),
    ];
  }

  private _findPlannedActionForLoadcell(step: ExecutionStep, loadcellId: string): Nullable<PlannedActionResult> {
    const allPlannedItems = this._getAllPlannedActions(step);
    const foundAction = allPlannedItems.find((action) => action.item.loadcellId === loadcellId);
    return foundAction || null;
  }

  private _validateChange(changedQty: number, plannedAction: PlannedActionResult): string | null {
    const { type, item } = plannedAction;
    const requestQty = item.requestQty;
    const itemName = item.name;

    switch (type) {
      case PlanActionType.ISSUE: {
        const hasTakenQty = -changedQty;
        if (hasTakenQty < 0) {
          return `Action was issue, but ${-hasTakenQty} of ${itemName} were added instead.`;
        }
        if (hasTakenQty > requestQty) {
          return `Over picked ${itemName}! Required: ${requestQty}, taken: ${hasTakenQty}.`;
        }
        if (hasTakenQty < requestQty) {
          return `Under picked ${itemName}! Required: ${requestQty}, taken: ${hasTakenQty}.`;
        }
        break;
      }
      case PlanActionType.RETURN: {
        const hasReturnedQty = changedQty;
        if (hasReturnedQty < 0) {
          return `Action was return, but ${-hasReturnedQty} of ${itemName} were taken instead.`;
        }
        if (hasReturnedQty > requestQty) {
          return `Over returned ${itemName}! Required: ${requestQty}, returned: ${hasReturnedQty}.`;
        }
        break;
      }
      case PlanActionType.REPLENISH: {
        const hasReplenishedQty = changedQty;
        if (hasReplenishedQty < 0) {
          return `Action was replenish, but ${-hasReplenishedQty} of ${itemName} were taken instead.`;
        }
        if (hasReplenishedQty > requestQty) {
          return `Over replenished ${itemName}! Required: ${requestQty}, replenished: ${hasReplenishedQty}.`;
        }
        if (hasReplenishedQty < requestQty) {
          return `Under replenished ${itemName}! Required: ${requestQty}, replenished: ${hasReplenishedQty}.`;
        }
        break;
      }
      case PlanActionType.KEEP_TRACK: {
        if (changedQty !== 0) {
          if (changedQty < 0) {
            return `Item ${itemName} should not be touched, but ${-changedQty} were taken.`;
          } else {
            return `Item ${itemName} should not be touched, but ${changedQty} were added.`;
          }
        }
        break;
      }
    }
    return null;
  }

  private _getWarningTopic(type: TransactionType): ProcessEventType {
    switch (type) {
      case TransactionType.ISSUE:
        return EVENT_TYPE.PROCESS.STEP_WARNING;
      case TransactionType.RETURN:
        return EVENT_TYPE.PROCESS.STEP_WARNING;
      case TransactionType.REPLENISH:
        return EVENT_TYPE.PROCESS.STEP_WARNING;
      default:
        return EVENT_TYPE.PROCESS.STEP_WARNING;
    }
  }

  private _getSuccessTopic(type: TransactionType): ProcessEventType {
    switch (type) {
      case TransactionType.ISSUE:
        return EVENT_TYPE.PROCESS.ISSUE_STEP_SUCCESS;
      case TransactionType.RETURN:
        return EVENT_TYPE.PROCESS.RETURN_STEP_SUCCESS;
      case TransactionType.REPLENISH:
        return EVENT_TYPE.PROCESS.REPLENISH_STEP_SUCCESS;
      default:
        return EVENT_TYPE.PROCESS.ISSUE_STEP_SUCCESS;
    }
  }

  private _getErrorTopic(type: TransactionType): ProcessEventType {
    switch (type) {
      case TransactionType.ISSUE:
        return EVENT_TYPE.PROCESS.ISSUE_STEP_ERROR;
      case TransactionType.RETURN:
        return EVENT_TYPE.PROCESS.RETURN_STEP_ERROR;
      case TransactionType.REPLENISH:
        return EVENT_TYPE.PROCESS.REPLENISH_STEP_ERROR;
      default:
        return EVENT_TYPE.PROCESS.ISSUE_STEP_ERROR;
    }
  }
}
