import { BaseEntity } from './base.entity';
import { Properties } from '@framework/types';

export class BinItemEntity extends BaseEntity {
  binId?: string;
  itemId?: string;
  order: number;
  batchNo?: string;
  serialNo?: string;
  min: number;
  max: number;
  critical: number;
  hasChargeTime: number;
  chargeTime?: string;
  hasCalibrationDue: boolean; // 0 | 1
  calibrationDue?: string;
  hasExpiryDate: number;
  expiryDate?: string;
  hasLoadHydrostaticTestDue: boolean; // 0 | 1
  loadHydrostaticTestDue?: string;
  description?: string;
}

export class BinItemWithIdAndName {
  id: string;
  name: string;
  constructor(props: Properties<BinItemWithIdAndName>) {
    Object.assign(this, props);
  }
}
