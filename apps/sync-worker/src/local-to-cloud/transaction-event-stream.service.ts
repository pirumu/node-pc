import { TransactionEventEntity } from '@dals/mongo/entities';
import { EntityManager } from '@mikro-orm/mongodb';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class TransactionEventStreamService implements OnModuleInit, OnModuleDestroy {
  private _changeStream: ReturnType<ReturnType<EntityManager['getCollection']>['watch']>;

  private readonly _logger = new Logger(TransactionEventEntity.name);

  constructor(private readonly _em: EntityManager) {}

  public async onModuleInit(): Promise<void> {
    const collection = this._em.getCollection(TransactionEventEntity);
    const txEventStream = collection.watch(
      [
        {
          $match: {
            operationType: { $in: ['insert', 'update'] },
          },
        },
      ],
      {
        fullDocument: 'updateLookup',
      },
    );
    txEventStream.on('change', (change) => {
      // this._logger.log('Change stream change:', change);
      if (change.operationType === 'insert' || change.operationType === 'update') {
        this._logger.log('Tx Event', change.operationType, change.fullDocument);
      }
    });

    txEventStream.on('error', (err) => {
      this._logger.error(err);
    });

    this._changeStream = txEventStream;
  }

  public async onModuleDestroy(): Promise<void> {
    return this._changeStream.close();
  }
}
