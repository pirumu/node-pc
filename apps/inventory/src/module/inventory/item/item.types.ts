import { PROCESS_ITEM_TYPE } from '@common/constants';
import { ProtocolType } from '@culock/protocols';

export type InputLocation = {
  bin: {
    id: string;
    name: string;
    row: number;
    cuId: number;
    lockId: number;
  };
  cabinet: {
    id: string;
    name: string;
  };
  requestQty: number;
  preQty: number;
};

export type InputItem = {
  id: string;
  name: string;
  itemTypeId: string;
  type: string;
  partNo: string;
  materialNo: string;
  conditionId: string | null;
  workingOrders: WorkingOrderData[];
  locations: InputLocation[];
};

// ======= OUTPUT TYPES =======

export type ProcessedUserData = {
  id: string;
  cloudId: string;
  loginId: string;
  role: string;
};

export type ProcessCabinetData = {
  id: string;
  name: string;
};

export type ProcessBinData = {
  id: string;
  name: string;
  row: number;
  cuId: number;
  lockId: number;
};

export type WorkingOrderData = {
  woId: string;
  wo: string;
  vehicleId: string;
  platform: string;
  areaId: string;
  torq: number;
  area: string;
};

export type ProcessItemData = {
  id: string;
  name: string;
  itemTypeId: string;
  type: string;
  partNo: string;
  materialNo: string;
  requestQty: number;
  preQty: number;
  conditionName: string | null;
  workingOrders: WorkingOrderData[];
  status: string | null;
};

export type ProcessDataResult = {
  cabinet: ProcessCabinetData;
  bin: ProcessBinData;
  requestItems: ProcessItemData[];
  storageItems: ProcessItemData[];
};

export type ProcessItemRequest = {
  transactionType: PROCESS_ITEM_TYPE;
  clusterId: string;
  user: ProcessedUserData;
  data: ProcessDataResult[];
  requestQty: number;
};

export type ExternalEvent = {
  protocol: ProtocolType;
  deviceId: number;
  lockId: number;
  user: ProcessedUserData;
  transactionType: PROCESS_ITEM_TYPE;
  data: ProcessDataResult;
  transactionId: string;
  isFinal: boolean;
};
