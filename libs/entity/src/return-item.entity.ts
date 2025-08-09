import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export type WorkingOrderItem = {
  woId: string;
  wo: string;
  vehicleId: string;
  platform: string;
  areaId: string;
  torq: number;
  area: string;
};

export type LocationItem = {
  cabinet: { id: string; name: string };
  bin: { id: string; name: string; row: number; cuId: number; lockId: number };
  preQty: number;
  requestQty: number;
  quantity: number;
};

export class ReturnItemEntity extends BaseEntity {
  itemId: string;
  userId: string;
  quantity: number;
  workingOrders: WorkingOrderItem[];
  locations: LocationItem[];
  binId: string;

  constructor(props: Properties<ReturnItemEntity>) {
    super();
    Object.assign(this, props);
  }
}
