import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { Ref } from '@mikro-orm/mongodb';

import { AbstractEntity } from './abstract.entity';
import { ItemEntity } from './item.entity';
import { LoadcellEntity } from './loadcell.entity';
// eslint-disable-next-line import/no-cycle
import { TransactionEntity } from './transaction.entity';

@Entity({ collection: 'transaction_events' })
export class TransactionEventEntity extends AbstractEntity {
  @ManyToOne(() => TransactionEntity, { fieldName: 'transactionId', ref: true })
  transaction!: Ref<TransactionEntity>;

  @ManyToOne(() => LoadcellEntity, { fieldName: 'loadcellId', ref: true })
  loadcell!: Ref<LoadcellEntity>;

  @ManyToOne(() => ItemEntity, { fieldName: 'itemId', ref: true })
  item!: Ref<ItemEntity>;

  @Property()
  stepId: string;

  @Property()
  output: any;

  @Property()
  quantityBefore!: number;

  @Property()
  quantityAfter!: number;

  @Property()
  quantityChanged!: number;

  constructor(data?: PartialProperties<TransactionEventEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
