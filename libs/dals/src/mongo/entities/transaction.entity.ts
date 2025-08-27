import { Nullable, PartialProperties } from '@framework/types';
import { Entity, Property, Enum, ManyToOne, OneToMany, Collection, Ref, Embeddable, Embedded } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
// eslint-disable-next-line import/no-cycle
import { TransactionEventEntity } from './transaction-event.entity';
import { UserEntity } from './user.entity';
import { AnotherItem, ItemToReplenish, ItemToReturn, ItemToTake, Location } from '@common/business/types';

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
  AWAITING_CORRECTION = 'AWAITING_CORRECTION',
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

  public setCurrentStepId(stepId: string): void {
    this.currentStepId = stepId;
  }

  public currentStep(stepId: string): Nullable<ExecutionStep> {
    return this.executionSteps.find((es) => es.stepId === stepId) || null;
  }

  public nextStep(stepId: string): Nullable<ExecutionStep> {
    const index = this.executionSteps.findIndex((es) => es.stepId === stepId);
    return this.executionSteps[index + 1] || null;
  }

  public isLastStep(stepId: string): boolean {
    return this.executionSteps[this.executionSteps.length - 1].stepId === stepId;
  }
}

@Embeddable()
export class ExecutionStep {
  @Property({ type: 'string' })
  stepId: string;

  @Property({ type: 'string' })
  binId: string;

  @Property({ type: 'json' })
  itemsToIssue: ItemToTake[] = [];

  @Property({ type: 'json' })
  itemsToReturn: ItemToReturn[] = [];

  @Property({ type: 'json' })
  itemsToReplenish: ItemToReplenish[] = [];

  @Property({ type: 'json' })
  keepTrackItems: AnotherItem[] = [];

  @Property({ type: 'json' })
  location: Location;

  @Property({ type: 'array' })
  instructions: string[] = [];
}
