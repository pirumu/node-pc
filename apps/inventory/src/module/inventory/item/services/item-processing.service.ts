import { ExecutionStep } from '@common/business/types';
import { TransactionEntity, TransactionStatus, TransactionType } from '@dals/mongo/entities';
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
  }): Promise<string> {
    const { userId, transactionType, totalRequestQty, executionSteps } = payload;

    const tx = this._em.create(TransactionEntity, {
      _id: new ObjectId(),
      type: transactionType,
      status: TransactionStatus.PENDING,
      user: new ObjectId(userId),
      currentStepId: executionSteps[0].stepId,
      executionSteps: executionSteps as any,
      totalRequestQty: totalRequestQty,
      isSync: false,
      createdAt: new Date(),
    });
    await this._em.persistAndFlush(tx);
    await this._publisherService.publish(Transport.MQTT, 'tx/start', { transactionId: tx.id });

    return tx.id;
  }
}
