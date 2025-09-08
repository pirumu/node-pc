import { Properties } from '@framework/types';
import { Entity, Property, Embedded, ManyToOne, Enum, Collection, Embeddable, OneToMany, Ref } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

import { AbstractEntity } from './abstract.entity';
import { CabinetEntity } from './cabinet.entity';
import { ClusterEntity } from './cluster.entity';
// eslint-disable-next-line import/no-cycle
import { LoadcellEntity } from './loadcell.entity';
import { SiteEntity } from './site.entity';

export const BIN_TYPES = {
  NORMAL: 'NORMAL',
  LOADCELL: 'LOADCELL',
} as const;

export type BinType = (typeof BIN_TYPES)[keyof typeof BIN_TYPES];

@Embeddable()
export class BinItem {
  @Property()
  itemId: ObjectId;

  @Property()
  qty: number;

  @Property()
  critical: number;

  @Property()
  min: number;

  @Property()
  max: number;

  @Property({ default: '' })
  description: string = '';

  @Property({ default: '' })
  barcode: string = '';

  @Property({ default: '' })
  rfid: string = '';

  @Property({ default: '' })
  serialNumber: string = '';

  @Property({ default: '' })
  batchNumber: string = '';

  @Property({ nullable: true })
  chargeTime?: Date;

  @Property({ nullable: true })
  inspection?: Date;

  @Property({ nullable: true })
  hydrostaticTest?: Date;

  @Property({ nullable: true })
  expiryDate?: Date;

  @Property({ nullable: true })
  position?: string;

  @Property({ default: 0 })
  damageQuantity: number = 0;
}

@Embeddable()
export class BinState {
  @Property({ default: false })
  isProcessing: boolean = false;

  @Property({ default: false })
  isFailed: boolean = false;

  @Property({ default: true })
  isLocked: boolean = true;

  @Property({ default: false })
  isDamaged: boolean = false;

  @Property({ default: 0 })
  failedOpenAttempts: number = 0;
}

@Entity({ collection: 'bins' })
export class BinEntity extends AbstractEntity {
  @ManyToOne(() => SiteEntity, {
    fieldName: 'siteId',
    ref: true,
    serializedName: 'siteId',
  })
  site!: Ref<SiteEntity>;

  @ManyToOne(() => ClusterEntity, { fieldName: 'clusterId', ref: true })
  cluster!: Ref<ClusterEntity>;

  @ManyToOne(() => CabinetEntity, { fieldName: 'cabinetId', ref: true })
  cabinet!: Ref<CabinetEntity>;

  @OneToMany(() => LoadcellEntity, (loadcell) => loadcell.bin, {
    fieldName: 'loadcellIds',
    nullable: true,
    default: [],
  })
  loadcells = new Collection<LoadcellEntity>(this);

  @Property()
  cuLockId: number;

  @Property()
  lockId: number;

  @Property()
  index: number;

  // Position properties
  @Property()
  x: number;

  @Property()
  y: number;

  @Property()
  width: number;

  @Property()
  height: number;

  // Quantity properties

  @Property()
  minQty: number;

  @Property()
  maxQty: number;

  @Property()
  criticalQty: number;

  @Enum({ items: () => BIN_TYPES, default: BIN_TYPES.NORMAL })
  type: BinType = BIN_TYPES.NORMAL;

  @Embedded(() => BinItem, { array: true, default: [] })
  items: BinItem[] = [];

  @Property({ nullable: true })
  antennaNo?: string;

  @Property({ nullable: true })
  gatewayIp?: string;

  @Embedded(() => BinState, { object: true })
  state = new BinState();

  constructor(data?: Properties<BinEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    if (!this.state) {
      this.state = new BinState();
    }
  }

  public incrementOpenFailedAttempt(): void {
    this.state.failedOpenAttempts++;
  }

  public hasExceededFailedAttempts(maxOpenAttempts: number): boolean {
    return this.state.failedOpenAttempts >= maxOpenAttempts;
  }

  public markFailed(): void {
    this.state.isFailed = true;
  }

  public markAlive(): void {
    this.state.failedOpenAttempts = 0;
    this.state.isFailed = false;
  }

  public activate(): void {
    this.markAlive();
  }

  public deactivate(): void {
    this.state.isFailed = true;
  }

  public markDamage(): void {
    this.state.isDamaged = true;
  }

  public removeLoadcell(loadcellId: ObjectId): void {
    this.loadcells.remove((loadcell) => loadcell._id.equals(loadcellId));
  }
}
