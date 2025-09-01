import { Nullable, PartialProperties, Properties } from '@framework/types';
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

  @OneToMany(() => TransactionEventEntity, (event) => event.transaction)
  events = new Collection<TransactionEventEntity>(this);

  @Property()
  totalRequestQty: number = 0;

  @Property()
  currentStepId: string;

  @Embedded(() => TxExecutionStep, { array: true })
  executionSteps: TxExecutionStep[] = [];

  @Embedded(() => TxWorkingOrder, { array: true })
  workingOrders: TxWorkingOrder[] = [];

  @Property({ type: 'json', nullable: true })
  lastError?: Record<string, any>;

  @Property({ nullable: true })
  completedAt?: Date;

  constructor(data?: PartialProperties<TransactionEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }

  public setCurrentStepId(stepId: string): void {
    this.currentStepId = stepId;
  }

  public currentStep(stepId: string): Nullable<TxExecutionStep> {
    return this.executionSteps.find((es) => es.stepId === stepId) || null;
  }

  public nextStep(stepId: string): Nullable<TxExecutionStep> {
    const index = this.executionSteps.findIndex((es) => es.stepId === stepId);
    return this.executionSteps[index + 1] || null;
  }

  public isLastStep(stepId: string): boolean {
    return this.executionSteps[this.executionSteps.length - 1].stepId === stepId;
  }
}

@Embeddable()
export class TxWorkingOrder {
  @Property({ type: 'string' })
  workingOderId: string;
  @Property({ type: 'string', nullable: true })
  areaId: string | null;

  constructor(props: Properties<TxWorkingOrder>) {
    Object.assign(this, props);
  }
}

@Embeddable()
export class TxLocation {
  @Property({ type: 'string' })
  binId: string;
  @Property({ type: 'string' })
  binName: string;
  @Property({ type: 'string' })
  cabinetId: string;
  @Property({ type: 'string' })
  cabinetName: string;
  @Property({ type: 'string' })
  clusterId: string;
  @Property({ type: 'string' })
  clusterName: string;
  @Property({ type: 'string' })
  siteId: string;
  @Property({ type: 'string' })
  siteName: string;

  constructor(props: Properties<TxLocation>) {
    Object.assign(this, props);
  }
}

@Embeddable()
export class TxItemToTake {
  @Property({ type: 'string' })
  itemId: string;
  @Property({ type: 'string' })
  name: string;
  @Property({ type: 'integer' })
  currentQty: number;
  @Property({ type: 'integer' })
  requestQty: number;
  @Property({ type: 'string' })
  loadcellId: string;

  @Property({ type: 'integer' })
  loadcellHardwareId: number;

  constructor(props: Properties<TxItemToTake>) {
    Object.assign(this, props);
  }
}

@Embeddable()
export class TxAnotherItem {
  @Property({ type: 'string' })
  binId: string;
  @Property({ type: 'string' })
  name: string;
  @Property({ type: 'string' })
  itemId: string;
  @Property({ type: 'string' })
  loadcellId: string;
  @Property({ type: 'integer' })
  currentQty: number;
  @Property({ type: 'integer' })
  loadcellHardwareId: number;

  constructor(props: Properties<TxAnotherItem>) {
    Object.assign(this, props);
  }
}

@Embeddable()
export class TXItemToReturn {
  @Property({ type: 'string' })
  itemId: string;
  @Property({ type: 'string' })
  name: string;
  @Property({ type: 'integer' })
  currentQty: number;
  @Property({ type: 'integer' })
  requestQty: number;
  @Property({ type: 'string' })
  loadcellId: string;

  @Property({ type: 'integer' })
  loadcellHardwareId: number;
  @Property({ type: 'string' })
  conditionId: string;

  constructor(props: Properties<TXItemToReturn>) {
    Object.assign(this, props);
  }
}

@Embeddable()
export class TxItemToReplenish {
  @Property({ type: 'string' })
  binId: string;
  @Property({ type: 'string' })
  name: string;
  @Property({ type: 'string' })
  itemId: string;
  @Property({ type: 'string' })
  loadcellId: string;
  @Property({ type: 'integer' })
  currentQty: number;
  @Property({ type: 'integer' })
  loadcellHardwareId: number;
  constructor(props: Properties<TxItemToReplenish>) {
    Object.assign(this, props);
  }
}

@Embeddable()
export class TxExecutionStep {
  @Property({ type: 'string' })
  stepId: string;

  @Property({ type: 'string' })
  binId: string;

  @Embedded(() => TxItemToTake, { array: true })
  itemsToIssue: TxItemToTake[] = [];

  @Embedded(() => TXItemToReturn, { array: true })
  itemsToReturn: TXItemToReturn[] = [];

  @Embedded(() => TxItemToReplenish, { array: true })
  itemsToReplenish: TxItemToReplenish[] = [];

  @Embedded(() => TxAnotherItem, { array: true })
  keepTrackItems: TxAnotherItem[] = [];

  @Embedded(() => TxLocation, { object: true })
  location: TxLocation;

  @Property({ type: 'array' })
  instructions: string[] = [];

  constructor(props: Properties<TxExecutionStep>) {
    Object.assign(this, props);
  }
}
