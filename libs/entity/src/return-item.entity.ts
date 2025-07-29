import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export type WorkOrderItem = {
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
  bin: { id: string; name: string; row: number };
  preQty: number;
  requestQty: number;
};

export class ReturnItemEntity extends BaseEntity {
  itemId: string;
  userId: string;
  quantity: number;
  listWo: WorkOrderItem[];
  locations: LocationItem[];
  binId: string;

  constructor(props: Properties<ReturnItemEntity>) {
    super();
    Object.assign(this, props);
  }
}
