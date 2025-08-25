import { ExecutionStep, ItemToTake, ItemToReturn, AnotherItem } from '@common/business/types';
import { EVENT_TYPE, ProcessEventType } from '@common/constants';
import { LoadcellEntity, TransactionEntity, TransactionEventEntity, TransactionType } from '@dals/mongo/entities';
import { PublisherService, Transport } from '@framework/publisher';
import { Nullable } from '@framework/types';
import { EntityManager, ObjectId, Reference, CreateRequestContext } from '@mikro-orm/mongodb';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

const POLLING_INTERVAL_MS = 1000;

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
  private _activePollingLoops = new Map<string, PollingContext>();

  constructor(
    private readonly _em: EntityManager,
    private readonly _publisher: PublisherService,
  ) {}

  public onModuleDestroy(): void {
    this._activePollingLoops.forEach((context, txId) => {
      this._logger.warn(`[${txId}] Forcibly stopping polling loop due to module destruction.`);
      clearInterval(context.intervalId);
    });
    this._activePollingLoops.clear();
  }

  @CreateRequestContext()
  public async handleBinOpened(event: { transactionId: string; binId: string }): Promise<void> {
    const { transactionId, binId } = event;

    this._stopPolling(transactionId);
    this._logger.log(`[${transactionId}] Bin ${binId} opened. Starting real-time DB polling.`);

    const tx = await this._em.findOneOrFail(TransactionEntity, { id: transactionId });
    const step = tx.currentStep(tx.currentStepId);
    if (!step || step.binId !== binId) {
      return;
    }

    const loadcells = await this._em.find(LoadcellEntity, {
      bin: new ObjectId(binId),
      item: { $ne: null },
    });

    const initialQuantities = new Map<string, number>();
    loadcells.forEach((lc) => {
      initialQuantities.set(lc.id, lc.calibration.availableQuantity);
    });

    const intervalId = setInterval(async () => this._pollingCycle(transactionId, tx.type), POLLING_INTERVAL_MS);

    this._activePollingLoops.set(transactionId, {
      intervalId,
      step: step as any, // stupid TypeScript
      initialQuantities,
      lastSentMessages: new Map(),
    });

    await this._publisher.publish(Transport.MQTT, EVENT_TYPE.PROCESS.INSTRUCTION, {
      transactionId,
      instructions: step.instructions,
    });
  }

  @CreateRequestContext()
  public async handleBinClosed(event: { transactionId: string; binId: string }): Promise<void> {
    const { transactionId, binId } = event;

    this._stopPolling(transactionId);
    this._logger.log(`[${transactionId}] Bin ${binId} closed. Persisting final results.`);

    const tx = await this._em.findOneOrFail(TransactionEntity, { id: transactionId });
    const step = tx.currentStep(tx.currentStepId);
    if (!step || step.binId !== binId) {
      return;
    }

    const finalLoadcells = await this._em.find(LoadcellEntity, {
      bin: new ObjectId(binId),
      item: { $ne: null },
    });

    const result = this._calculateFinalStepResult(tx, step as any, finalLoadcells);

    if (result.events.length > 0) {
      await this._em.persistAndFlush(result.events);
    }

    const eventType = result.isValid ? this._getSuccessTopic(tx.type) : this._getErrorTopic(tx.type);

    await this._publisher.publish(Transport.MQTT, eventType, {
      transactionId,
      stepId: step.stepId,
      errors: result.errorMessages,
    });
  }

  private async _pollingCycle(transactionId: string, transactionType: TransactionType): Promise<void> {
    const context = this._activePollingLoops.get(transactionId);
    if (!context) {
      this._stopPolling(transactionId);
      return;
    }

    const { step, initialQuantities, lastSentMessages } = context;
    const loadcellsInBin = await this._em.find(LoadcellEntity, {
      bin: new ObjectId(step.binId),
      item: { $ne: null },
    });

    for (const loadcell of loadcellsInBin) {
      const initialQty = initialQuantities.get(loadcell.id);
      if (initialQty === undefined) {
        continue;
      }

      const currentQty = this._calculateCurrentQuantityFromWeight(loadcell);
      const changedQty = currentQty - initialQty;

      const plannedAction = this._findPlannedActionForLoadcell(step, loadcell.id);
      if (!plannedAction) {
        continue;
      }

      const takenOrReturnedQty = plannedAction.type === PlanActionType.ISSUE ? -changedQty : changedQty;
      const message = `Taken: ${takenOrReturnedQty}/${plannedAction.item.requestQty}`;

      if (lastSentMessages.get(plannedAction.item.itemId) !== message) {
        await this._publisher.publish(Transport.MQTT, EVENT_TYPE.PROCESS.QTY_CHANGED, {
          transactionId,
          itemId: plannedAction.item.itemId,
          message: message,
        });
        lastSentMessages.set(plannedAction.item.itemId, message);
      }

      const validationError = this._validateChange(changedQty, plannedAction);
      const errorKey = `error-${plannedAction.item.itemId}`;
      if (validationError) {
        if (lastSentMessages.get(errorKey) !== validationError) {
          await this._publisher.publish(Transport.MQTT, this._getWarningTopic(transactionType), {
            transactionId,
            message: validationError,
          });
          lastSentMessages.set(errorKey, validationError);
        }
      } else {
        if (lastSentMessages.has(errorKey)) {
          lastSentMessages.delete(errorKey);
        }
      }
    }
  }

  private _stopPolling(transactionId: string): void {
    if (this._activePollingLoops.has(transactionId)) {
      clearInterval(this._activePollingLoops.get(transactionId)!.intervalId);
      this._activePollingLoops.delete(transactionId);
      this._logger.log(`[${transactionId}] Polling loop stopped.`);
    }
  }

  private _calculateFinalStepResult(
    transaction: TransactionEntity,
    step: ExecutionStep,
    finalLoadcells: LoadcellEntity[],
  ): StepCalculationResult {
    const result: StepCalculationResult = {
      isValid: true,
      events: [],
      errorMessages: [],
    };

    const allPlannedActions = this._getAllPlannedActions(step);

    for (const plannedAction of allPlannedActions) {
      const loadcell = finalLoadcells.find((lc) => lc.id === plannedAction.item.loadcellId);
      if (!loadcell) {
        result.isValid = false;
        result.errorMessages.push(`Loadcell for item ${plannedAction.item.itemId} not found.`);
        continue;
      }

      const quantityBefore = plannedAction.item.currentQty;
      const quantityAfter = loadcell.calibration.availableQuantity;
      const quantityChanged = quantityAfter - quantityBefore;

      // FIX 1: Logic for "user did nothing" error
      if (plannedAction.type !== PlanActionType.KEEP_TRACK && quantityChanged === 0) {
        result.isValid = false;
        result.errorMessages.push(`No action was taken for item ${plannedAction.item.itemId}.`);
      }

      if (quantityChanged !== 0) {
        // FIX 2: Use Reference.create() for relations
        const transactionEvent = new TransactionEventEntity({
          transaction: Reference.create(transaction),
          loadcell: Reference.create(loadcell),
          item: Reference.create(loadcell.item!),
          quantityBefore,
          quantityAfter,
          quantityChanged,
        });
        result.events.push(transactionEvent);
      }

      const validationError = this._validateChange(quantityChanged, plannedAction);
      if (validationError) {
        result.isValid = false;
        result.errorMessages.push(validationError);
      }
    }
    return result;
  }

  private _calculateCurrentQuantityFromWeight(loadcell: LoadcellEntity): number {
    const { reading, calibration } = loadcell;
    if (!calibration.unitWeight || calibration.unitWeight === 0) {
      this._logger.warn(`[LC-${loadcell.code}] Unit weight is zero. Cannot calculate quantity.`);
      return calibration.availableQuantity;
    }
    const netWeight = reading.currentWeight - calibration.zeroWeight;
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
        return EVENT_TYPE.PROCESS.ISSUE_STEP_WARNING;
      case TransactionType.RETURN:
        return EVENT_TYPE.PROCESS.RETURN_STEP_WARNING;
      case TransactionType.REPLENISH:
        return EVENT_TYPE.PROCESS.REPLENISH_STEP_WARNING;
      default:
        return EVENT_TYPE.PROCESS.ISSUE_STEP_WARNING;
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
