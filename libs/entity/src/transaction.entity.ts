import { PROCESS_ITEM_TYPE } from '@common/constants';
import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export type UserInfo = {
  id: string;
  cloudId: string;
  loginId: string;
  role: string;
};

export type CabinetInfo = {
  id: string;
  name: string;
};

export type BinInfo = {
  id: string;
  name: string;
  row: number;
  cuId: number;
  lockId: number;
};

export type WorkingOrderInfo = {
  woId: string;
  wo: string;
  vehicleId: string;
  platform: string;
  areaId: string;
  torq: number;
  area: string;
};

export type SpareInfo = {
  id: string;
  name: string;
  partNo: string;
  materialNo: string;
  itemTypeId: string;
  type: string;
  conditionName: string;
  quantity: number;
  previousQty: number;
  currentQty: number;
  changedQty: number;
  workingOrders: WorkingOrderInfo[];
};

export type LocationInfo = {
  cabinet: CabinetInfo;
  bin: BinInfo;
  spares: SpareInfo[];
};

export class TransactionEntity extends BaseEntity {
  name: string;
  type: PROCESS_ITEM_TYPE;
  requestQty: number;
  clusterId: string;
  user: UserInfo;
  locations: LocationInfo[];
  locationsTemp: LocationInfo[];
  status: string;
  isSync: boolean;
  retryCount: number;
  error: any;

  constructor(props: Properties<TransactionEntity>) {
    super();
    if (props) {
      Object.assign(this, props);
    }
    this.isSync = this.isSync ?? false;
    this.retryCount = this.retryCount ?? 0;
  }
}
