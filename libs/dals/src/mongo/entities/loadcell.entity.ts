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
  isCalibrated = false;

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

  @Property({ default: 0 })
  calculatedWeight = 0;

  @Property({ default: null, nullable: true })
  calibrationDue: Date | null = null;
}

@Embeddable()
export class LiveReading {
  @Property({ default: 0 })
  currentWeight = 0;

  @Property({ default: 0 })
  pendingChange = 0;
}

@Embeddable()
export class LoadcellMetadata {
  @Property({ default: null, nullable: true })
  itemId: ObjectId | null = null;

  @Property({ default: 0 })
  qty: number = 0;

  @Property({ default: 0 })
  critical: number = 0;

  @Property({ default: 0 })
  min: number = 0;

  @Property({ default: 0 })
  max: number = 0;

  @Property({ default: 0 })
  qtyOriginal: number = 0;

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
  @ManyToOne(() => SiteEntity, { fieldName: 'siteId', ref: true, nullable: true })
  site: Ref<SiteEntity> | null;

  @ManyToOne(() => ClusterEntity, { ref: true, fieldName: 'clusterId', nullable: true })
  cluster: Ref<ClusterEntity> | null;

  @ManyToOne(() => CabinetEntity, { ref: true, fieldName: 'cabinetId', nullable: true })
  cabinet: Ref<CabinetEntity> | null;

  @ManyToOne(() => BinEntity, { ref: true, fieldName: 'binId', nullable: true })
  bin: Ref<BinEntity> | null;

  @ManyToOne(() => ItemEntity, { ref: true, fieldName: 'itemId', nullable: true })
  item: Ref<ItemEntity> | null;

  @Property()
  code: string = '';

  @Property({ default: '' })
  label: string = '';

  @Embedded(() => LoadcellMetadata, { object: true })
  metadata = new LoadcellMetadata(); // item.

  @Embedded(() => CalibrationData, { object: true })
  calibration = new CalibrationData(); // local fields

  @Embedded(() => LiveReading, { object: true })
  liveReading = new LiveReading(); // local fields

  @Embedded(() => LoadcellState, { object: true })
  state = new LoadcellState(); // local fields

  @ManyToOne(() => PortEntity, {
    fieldName: 'portId',
    nullable: true,
    ref: true,
  })
  port: Ref<PortEntity> | null; // local fields

  @Property({ default: 0 })
  hardwareId: number = 0; // local fields

  @Property({ default: 0 })
  availableQuantity = 0; // local fields

  @Property({ default: 0 })
  damageQuantity = 0; // local fields

  @Property({ default: 0 })
  heartbeat: number = 0; // local fields

  constructor(data?: PartialProperties<LoadcellEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }

  public reset(): void {
    this.hardwareId = 0;
    this.port = null;
    this.state = new LoadcellState();
    this.liveReading = new LiveReading();
    this.calibration = new CalibrationData();
    this.availableQuantity = 0;
    this.availableQuantity = 0;
    this.damageQuantity = 0;
  }
}
