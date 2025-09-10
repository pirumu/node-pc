import { BinItemType } from '@common/business/types';
import { EVENT_TYPE } from '@common/constants';
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
  TxAnotherItem,
  TxExecutionStep,
  TXItemToReturn,
  TxItemToTake,
} from '@dals/mongo/entities';
import { PublisherService, Transport } from '@framework/publisher';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { MongoEntityManager, ObjectId } from '@mikro-orm/mongodb';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

const LOCK_POLLING_INTERVAL_MS = 1000;
const NEED_INSTRUCTIONS = process.env.NEED_INSTRUCTIONS || false;

export enum PlanActionType {
  ISSUE = 'issue',
  RETURN = 'return',
  REPLENISH = 'replenish',
  KEEP_TRACK = 'keepTrack',
}

export type PollingContext = {
  intervalId: NodeJS.Timeout;
  step: TxExecutionStep;
};

export type LockPollingContext = PollingContext;

export type StepCalculationResult = {
  isValid: boolean;
  events: TransactionEventEntity[];
  validationResults: ValidationResult[];
};

export type PlannedActionResult = {
  type: PlanActionType;
  item: TxItemToTake | TXItemToReturn | TxAnotherItem;
};

export type ValidationResult = {
  itemName: string;
  itemId: string;
  actualQty: number;
  expectQty: number;
  msg: string;
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
        step: step,
      });

      if (NEED_INSTRUCTIONS) {
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
      }
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
      console.log(step);
      const finalLoadcells = await em.find(LoadcellEntity, {
        bin: new ObjectId(binId),
        item: { $ne: null },
      });

      const result = this._calculateFinalStepResult(em, step, finalLoadcells, tx.type);

      if (result.events.length > 0) {
        const events = result.events.map((e) => {
          return {
            transactionId: tx._id,
            itemId: e.item._id,
            binId: e.bin._id,
            loadcell: e.loadcell?._id || null,
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

      const channel = result.isValid ? EVENT_TYPE.PROCESS.STEP_SUCCESS : EVENT_TYPE.PROCESS.STEP_ERROR;

      this._publisher
        .publish(
          Transport.MQTT,
          channel,
          {
            transactionId,
            stepId: step.stepId,
            errors: result.validationResults,
          },
          {},
          { async: true },
        )
        .catch((err) => this._logger.error(err));
    });
  }

  private _stopLockPolling(transactionId: string): void {
    if (this._activePollingLockStatusLoops.has(transactionId)) {
      clearInterval(this._activePollingLockStatusLoops.get(transactionId)!.intervalId);
      this._activePollingLockStatusLoops.delete(transactionId);
      this._logger.log(`[${transactionId}] Lock Polling loop stopped.`);
    }
  }

  private _calculateFinalStepResult(
    em: any,
    step: TxExecutionStep,
    finalLoadcells: LoadcellEntity[],
    txType: TransactionType,
  ): StepCalculationResult {
    const result: StepCalculationResult = {
      isValid: true,
      events: [],
      validationResults: [],
    };

    const allPlannedActions = this._getAllPlannedActions(step);

    for (const index in allPlannedActions) {
      const validationResults: ValidationResult[] = [];

      const plannedAction = allPlannedActions[index];

      const isProcessLoadcellItem = plannedAction.item.binItemType === BinItemType.LOADCELL;

      const loadcell = finalLoadcells.find((lc) => lc.id === plannedAction.item.loadcellId);

      if (isProcessLoadcellItem) {
        if (!loadcell) {
          result.isValid = false;
          validationResults.push({
            itemName: plannedAction.item.name,
            itemId: plannedAction.item.itemId,
            expectQty: plannedAction.item.requestQty,
            actualQty: 0,
            msg: `Loadcell for item ${plannedAction.item.itemId} not found.`,
          });
          continue;
        }
      }

      const quantityBefore = plannedAction.item.currentQty;

      let quantityAfter = 0;

      if (loadcell) {
        // loadcell item.
        quantityAfter = loadcell.availableQuantity + loadcell.liveReading.pendingChange;
      } else {
        // normal item.
        quantityAfter =
          txType === TransactionType.ISSUE
            ? plannedAction.item.currentQty - plannedAction.item.requestQty
            : plannedAction.item.currentQty + plannedAction.item.requestQty;
      }

      const quantityChanged = quantityAfter - quantityBefore;

      // if (plannedAction.type !== PlanActionType.KEEP_TRACK && quantityChanged === 0) {
      //   result.isValid = false;
      //   validationResults.push({
      //     itemName: plannedAction.item.name,
      //     itemId: plannedAction.item.itemId,
      //     actualQty: 0,
      //     expectQty: plannedAction.item.requestQty,
      //     msg: `No action was taken for item ${plannedAction.item.name}.`,
      //   });
      // }

      const validationError = this._validateChange(quantityChanged, plannedAction);
      if (validationError) {
        result.isValid = false;
        validationResults.push(validationError);
      }

      const transactionEvent = new TransactionEventEntity({
        quantityBefore,
        quantityAfter,
        quantityChanged,
        stepId: step.stepId,
        output: {
          isValid: result.isValid,
          errors: validationResults,
        },
      });

      em.assign(transactionEvent, {
        bin: {
          _id: new ObjectId(plannedAction.item.binId),
        },
        item: {
          _id: new ObjectId(plannedAction.item.itemId),
        },
        loadcell: loadcell,
      });

      result.events.push(transactionEvent);
      result.validationResults.push(...validationResults);
    }
    return result;
  }

  private _getAllPlannedActions(step: TxExecutionStep) {
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

  private _validateChange(changedQty: number, plannedAction: PlannedActionResult): ValidationResult | null {
    const { type, item } = plannedAction;
    const requestQty = item.requestQty;
    const itemName = item.name;

    switch (type) {
      case PlanActionType.ISSUE: {
        const actualQty = -changedQty; // hasTakenQty
        const expectQty = requestQty;
        if (actualQty < 0) {
          return {
            itemName: item.name,
            itemId: item.itemId,
            actualQty,
            expectQty,
            msg: `Action was issue, but ${-actualQty} of ${itemName} were added instead.`,
          };
        }
        if (actualQty > expectQty) {
          return {
            itemName: item.name,
            itemId: item.itemId,
            actualQty,
            expectQty,
            msg: `Over picked ${itemName}! Required: ${expectQty}, taken: ${actualQty}.`,
          };
        }
        if (actualQty < expectQty) {
          return {
            itemName: item.name,
            itemId: item.itemId,
            actualQty,
            expectQty,
            msg: `Under picked ${itemName}! Required: ${expectQty}, taken: ${actualQty}.`,
          };
        }
        return null;
      }

      case PlanActionType.RETURN: {
        const actualQty = changedQty; // hasReturnedQty
        const expectQty = requestQty;

        if (actualQty < 0) {
          return {
            itemName: item.name,
            itemId: item.itemId,
            actualQty,
            expectQty,
            msg: `Action was return, but ${-actualQty} of ${itemName} were taken instead.`,
          };
        }
        if (actualQty > expectQty) {
          return {
            itemName: item.name,
            itemId: item.itemId,
            actualQty,
            expectQty,
            msg: `Over returned ${itemName}! Required: ${expectQty}, returned: ${actualQty}.`,
          };
        }
        return null;
      }

      case PlanActionType.REPLENISH: {
        const actualQty = changedQty; // hasReplenishedQty
        const expectQty = requestQty;

        if (actualQty < 0) {
          return {
            itemName: item.name,
            itemId: item.itemId,
            actualQty,
            expectQty,
            msg: `Action was replenish, but ${-actualQty} of ${itemName} were taken instead.`,
          };
        }
        if (actualQty > expectQty) {
          return {
            itemName: item.name,
            itemId: item.itemId,
            actualQty,
            expectQty,
            msg: `Over replenished ${itemName}! Required: ${expectQty}, replenished: ${actualQty}.`,
          };
        }
        if (actualQty < expectQty) {
          return {
            itemName: item.name,
            itemId: item.itemId,
            actualQty,
            expectQty,
            msg: `Under replenished ${itemName}! Required: ${expectQty}, replenished: ${actualQty}.`,
          };
        }
        return null;
      }

      case PlanActionType.KEEP_TRACK: {
        const actualQty = changedQty;
        const expectQty = 0;

        if (actualQty !== 0) {
          const msg =
            actualQty < 0
              ? `Item ${itemName} should not be touched, but ${-actualQty} were taken.`
              : `Item ${itemName} should not be touched, but ${actualQty} were added.`;

          return { itemName: item.name, itemId: item.itemId, actualQty, expectQty, msg };
        }
        return null;
      }

      default:
        return {
          itemName: 'unknown',
          itemId: item.itemId,
          actualQty: changedQty,
          expectQty: 0,
          msg: `Unknown action type: ${type}`,
        };
    }
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
}
