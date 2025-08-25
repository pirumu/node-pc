import { Nullable, PartialProperties } from '@framework/types';
import { Entity, Property, Enum, ManyToOne, OneToMany, Collection, Ref, Embeddable, Embedded } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
// eslint-disable-next-line import/no-cycle
import { TransactionEventEntity } from './transaction-event.entity';
import { UserEntity } from './user.entity';

export enum TransactionType {
  ISSUE = 'ISSUE',
  RETURN = 'RETURN',
  REPLENISH = 'REPLENISH',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  COMPLETED_WITH_ERROR = 'COMPLETED_WITH_ERROR',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@Entity({ collection: 'transactions' })
export class TransactionEntity extends AbstractEntity {
  @Enum(() => TransactionType)
  type!: TransactionType;

  @Enum(() => TransactionStatus)
  status: TransactionStatus = TransactionStatus.PENDING;

  @ManyToOne(() => UserEntity, { fieldName: 'userId', ref: true })
  user!: Ref<UserEntity>;

  @OneToMany(() => TransactionEventEntity, (event) => event.transaction, {
    orphanRemoval: true,
    persist: false,
  })
  events = new Collection<TransactionEventEntity>(this);

  @Property()
  totalRequestQty: number = 0;

  @Property()
  currentStepId: string;

  @Embedded(() => ExecutionStep)
  executionSteps: ExecutionStep[] = [];

  @Property({ default: false })
  isSync: boolean = false;

  @Property({ type: 'json', nullable: true })
  lastError?: Record<string, any>;

  @Property({ nullable: true })
  completedAt?: Date;

  constructor(data?: PartialProperties<TransactionEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  public setCurrentStepId(id: string): void {
    this.currentStepId = id;
  }

  public currentStep(id: string): Nullable<ExecutionStep> {
    return this.executionSteps.find((es) => es.stepId === id) || null;
  }
}

export type Location = {
  binId: string;
};

export type AnotherItem = {
  binId: string;
  itemId: string;
  loadcellId: string;
  loadcellHardwareId: number;
  quantity: number;
};

export type PlannedItem = {
  itemId: string;
  loadcellId: string;
  loadcellHardwareId: number;
  name: string;
  requestQty: number;
  location: Location;
  keepTrackItems: AnotherItem[];
  conditionId?: string;
};

export type ItemToTake = {
  itemId: string;
  loadcellHardwareId: number;
  name: string;
  requestQty: number;
  loadcellId: string;
};

export type ItemToReturn = ItemToTake & { conditionId?: string };
export type ItemToReplenish = ItemToTake;

@Embeddable()
export class ExecutionStep {
  @Property({ type: 'string' })
  stepId: string;

  @Property({ type: 'string' })
  binId: string;

  @Property({ type: 'json' })
  itemsToIssue: ItemToTake[];

  @Property({ type: 'json' })
  itemsToReturn: ItemToReturn[];

  @Property({ type: 'json' })
  itemsToReplenish: ItemToReplenish[];

  @Property({ type: 'json' })
  keepTrackItems: AnotherItem[];

  @Property({ type: 'array' })
  instructions: string[];
}
