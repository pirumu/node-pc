import { TransactionEntity } from '@dals/mongo/entities';
import { EntityManager } from '@mikro-orm/mongodb';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class TransactionStreamService implements OnModuleInit, OnModuleDestroy {
  private _changeStream: ReturnType<ReturnType<EntityManager['getCollection']>['watch']>;

  private readonly _logger = new Logger(TransactionEntity.name);

  constructor(private readonly _em: EntityManager) {}

  public async onModuleInit(): Promise<void> {
    const collection = this._em.getCollection(TransactionEntity);
    const txStream = collection.watch(
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
    txStream.on('change', (change) => {
      this._logger.log('Change stream change:', change);
      if (change.operationType === 'insert' || change.operationType === 'update') {
        this._logger.log('Tx', change.operationType, change.fullDocument);
      }
    });

    txStream.on('error', (err) => {
      this._logger.error(err);
    });

    this._changeStream = txStream;
  }

  public async onModuleDestroy(): Promise<void> {
    return this._changeStream.close();
  }
}
