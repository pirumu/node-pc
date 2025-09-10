import { ExecutionStep } from '@common/business/types';
import { EVENT_TYPE } from '@common/constants';
import {
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  Synchronization,
  TxExecutionStep,
  TxItemToTake,
  TXItemToReturn,
  TxItemToReplenish,
  TxAnotherItem,
  TxLocation,
  TxWorkingOrder,
} from '@dals/mongo/entities';
import { PublisherService, Transport } from '@framework/publisher';
import { EntityManager, ObjectId } from '@mikro-orm/mongodb';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ItemProcessingService {
  constructor(
    private readonly _em: EntityManager,
    private readonly _publisherService: PublisherService,
  ) {}

  public async createAndStartTransaction(payload: {
    userId: string;
    transactionType: TransactionType;
    totalRequestQty: number;
    executionSteps: ExecutionStep[];
    workingOrders?: { workingOrderId: string; areaId?: string }[];
  }): Promise<string> {
    const { userId, transactionType, totalRequestQty, executionSteps, workingOrders = [] } = payload;

    const tx = this._em.create(TransactionEntity, {
      _id: new ObjectId(),
      type: transactionType,
      status: TransactionStatus.PENDING,
      user: new ObjectId(userId),
      currentStepId: executionSteps[0].stepId,
      executionSteps: executionSteps.map((s) => {
        return new TxExecutionStep({
          stepId: s.stepId,
          binId: s.binId,
          itemsToIssue: s.itemsToIssue.map((s) => new TxItemToTake(s)),
          itemsToReturn: s.itemsToReturn.map((s) => new TXItemToReturn(s)),
          itemsToReplenish: s.itemsToReplenish.map((s) => new TxItemToReplenish(s)),
          keepTrackItems: s.keepTrackItems.map((s) => new TxAnotherItem(s)),
          instructions: s.instructions,
          location: new TxLocation(s.location),
          issueHistories: s.issueHistories,
        });
      }),
      totalRequestQty: totalRequestQty,
      createdAt: new Date(),
      synchronization: new Synchronization(),
      workingOrders: workingOrders.map(
        (w) =>
          new TxWorkingOrder({
            workingOderId: w.workingOrderId,
            areaId: w.areaId || null,
          }),
      ),
    });
    await this._em.persistAndFlush(tx);
    await this._publisherService.publish(Transport.MQTT, EVENT_TYPE.PROCESS.START, { transactionId: tx.id }, {}, { async: true });

    return tx.id;
  }
}
