import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne, Embeddable, Embedded } from '@mikro-orm/core';
import { Ref } from '@mikro-orm/mongodb';

import { AbstractEntity } from './abstract.entity';
import { BinEntity } from './bin.entity';
import { ItemEntity } from './item.entity';
import { LoadcellEntity } from './loadcell.entity';
// eslint-disable-next-line import/no-cycle
import { TransactionEntity } from './transaction.entity';

@Entity({ collection: 'transaction_events' })
export class TransactionEventEntity extends AbstractEntity {
  @ManyToOne(() => TransactionEntity, { fieldName: 'transactionId', ref: true })
  transaction!: Ref<TransactionEntity>;

  @ManyToOne(() => LoadcellEntity, { fieldName: 'loadcellId', ref: true, nullable: true })
  loadcell: Ref<LoadcellEntity> | null;

  @ManyToOne(() => BinEntity, { fieldName: 'binId', ref: true })
  bin: Ref<BinEntity>;

  @ManyToOne(() => ItemEntity, { fieldName: 'itemId', ref: true })
  item!: Ref<ItemEntity>;

  @Property()
  stepId: string;

  @Embedded(() => EventOutput, { object: true })
  output = new EventOutput();

  @Property()
  quantityBefore!: number;

  @Property()
  quantityAfter!: number;

  @Property()
  quantityChanged!: number;

  constructor(data?: PartialProperties<TransactionEventEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }
}

@Embeddable()
export class EventOutput {
  @Property()
  isValid: boolean;

  @Property({ type: 'array', default: [] })
  errors: Array<{
    itemId: string;
    actualQty: number;
    expectQty: number;
    msg: string;
  }>;

  constructor(data?: PartialProperties<EventOutput>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
