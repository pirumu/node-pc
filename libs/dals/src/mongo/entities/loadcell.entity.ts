import { PartialProperties } from '@framework/types';
import { ObjectId, Ref, Entity, Property, Embedded, ManyToOne, Embeddable, Reference } from '@mikro-orm/mongodb';

import { AbstractEntity } from './abstract.entity';
// eslint-disable-next-line import/no-cycle
import { BinEntity } from './bin.entity';
import { CabinetEntity } from './cabinet.entity';
import { ClusterEntity } from './cluster.entity';
// eslint-disable-next-line import/no-cycle
import { ItemEntity } from './item.entity';
import { PortEntity } from './port.entity';
import { SiteEntity } from './site.entity';

export const LOADCELL_STATUS = {
  RUNNING: 'RUNNING',
  IDLE: 'IDLE',
  CREATED: 'CREATED',
  ERROR: 'ERROR',
} as const;

export type LoadcellStatus = (typeof LOADCELL_STATUS)[keyof typeof LOADCELL_STATUS];

@Embeddable()
export class LoadcellState {
  @Property({ default: false })
  isUpdatedWeight = false;

  @Property({ type: 'string', default: LOADCELL_STATUS.CREATED })
  status: LoadcellStatus = LOADCELL_STATUS.CREATED;

  @Property({ default: false })
  isCalibrated: boolean;

  @Property({ default: false })
  isRunning = false;
}

@Embeddable()
export class CalibrationData {
  @Property({ default: 0 })
  zeroWeight = 0;

  @Property({ default: 0 })
  unitWeight = 0;

  @Property({ default: 0 })
  calibratedQuantity = 0;

  @Property({ default: null, nullable: true })
  calibrationDue: Date | null = null;
}

@Embeddable()
export class LiveReading {
  @Property({ default: 0 })
  currentWeight = 0;

  @Property({ default: 0 })
  pendingChange: number;
}

@Embeddable()
export class LoadcellMetadata {
  @Property()
  itemId!: ObjectId;

  @Property()
  qty!: number;

  @Property()
  critical!: number;

  @Property()
  min!: number;

  @Property()
  max!: number;

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
}

@Entity({ collection: 'loadcells' })
export class LoadcellEntity extends AbstractEntity {
  @ManyToOne(() => SiteEntity, { fieldName: 'siteId', ref: true })
  site!: Ref<SiteEntity>;

  @ManyToOne(() => ClusterEntity, { ref: true, fieldName: 'clusterId', nullable: true })
  cluster: Ref<ClusterEntity> | null;

  @ManyToOne(() => CabinetEntity, { ref: true, fieldName: 'cabinetId', nullable: true })
  cabinet: Ref<CabinetEntity> | null;

  @ManyToOne(() => BinEntity, { ref: true, fieldName: 'binId', nullable: true })
  bin: Ref<BinEntity> | null;

  @ManyToOne(() => ItemEntity, { ref: true, fieldName: 'itemId', nullable: true })
  item: Ref<ItemEntity> | null;

  @Property()
  code: string;

  @Property({ default: '' })
  label: string = '';

  @Embedded(() => LoadcellMetadata, { object: true })
  metadata = new LoadcellMetadata(); // item.

  @Embedded(() => CalibrationData, { object: true })
  calibration = new CalibrationData();

  @Embedded(() => LiveReading, { object: true })
  liveReading = new LiveReading();

  @Embedded(() => LoadcellState, { object: true })
  state = new LoadcellState();

  @ManyToOne(() => PortEntity, {
    fieldName: 'portId',
    nullable: true,
    ref: true,
  })
  port: Ref<PortEntity> | null;

  @Property({ default: 0 })
  hardwareId: number = 0;

  @Property({ default: 0 })
  availableQuantity = 0;

  @Property({ default: 0 })
  damageQuantity = 0;

  @Property({ default: 0 })
  heartbeat: number = 0;

  constructor(data?: PartialProperties<LoadcellEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  public unassign(): void {
    this.metadata = new LoadcellMetadata();
    this.item = Reference.create(new ItemEntity());
    this.bin = Reference.create(new BinEntity());
    this.liveReading = new LiveReading();
    this.state = new LoadcellState();
    this.calibration = new CalibrationData();
  }
}
