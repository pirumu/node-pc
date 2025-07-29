import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export class DeviceDescriptionEntity {
  name?: string;
  partNumber?: string;
  materialNo?: string;
  supplierEmail?: string;
  matlGrp?: string;
  criCode?: string;
  jom?: string;
  itemAcct?: string;
  field1?: number;

  // Bag 1 - Primary bag information
  expiryBag?: string;
  quantityBag?: string;
  bagNoBatch?: string;

  // Bag 2 - Secondary bag information
  expiryBag2?: string;
  quantityBag2?: string;
  bagNoBatch2?: string;

  // Bag 3 - Tertiary bag information
  expiryBag3?: string;
  quantityBag3?: string;
  bagNoBatch3?: string;

  constructor(data?: Properties<DeviceDescriptionEntity>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}

export class DeviceEntity extends BaseEntity {
  deviceNumId: number;
  portId: string;
  binId: string;
  itemId: string;
  quantity: number;
  calcQuantity: number;
  damageQuantity: number;
  weight: number;
  zeroWeight: number;
  unitWeight: number;
  calcWeight: number;
  quantityMinThreshold: number;
  quantityCritThreshold: number;
  macAddress: string;
  chipId: string;
  heartbeat: number;
  setupTimestamp: string;
  zeroTimestamp: string;
  weightHistory: string;
  count: number;
  changeQty: number;
  status: string;
  isSync: boolean;
  retryCount: number;
  isUpdateWeight: number;
  label: string | null;
  description: DeviceDescriptionEntity;

  constructor(data: Properties<DeviceEntity>) {
    super();
    Object.assign(this, data);
    if (data.description) {
      this.description = new DeviceDescriptionEntity(data.description);
    }
  }
}
