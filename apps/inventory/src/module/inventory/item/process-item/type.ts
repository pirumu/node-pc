export type User = {
  id: string;
  user_cloud_id: string;
  userLogin: string;
  userRole: string;
};

export type BinData = {
  id: number;
  cu_id: string;
  lock_id: string;
  is_failed: boolean;
  is_locked: number;
  count_failed: number;
  name: string;
  row: string;
};

export type Cabinet = {
  id: number;
  name: string;
};

export type ItemSpare = {
  id: string;
  type: string;
  changed_qty: number;
  listWO?: any[];
};

export type ItemData = {
  bin: BinData;
  cabinet?: Cabinet;
  spares?: ItemSpare[];
};

export type ProcessItemJobData = {
  token: string;
  type: 'issue' | 'return';
  user: User;
  data: ItemData[];
  request_qty: number;
  uniqueId: string;
};

export type MqttMessage = {
  deviceType: string;
  deviceId: string;
  lockId: string;
  user: User;
  type: string;
  data: ItemData;
  transId: number;
  is_final: boolean;
};

export type TabletSetting = {
  clusterId: string;
};

export type LocationData = {
  cabinet: Cabinet;
  bin: {
    id: number;
    name: string;
    row: string;
  };
  spares: ItemSpare[];
};

export type ProcessContext = {
  // State flags (replacing the original flags)
  isCloseWarningPopup: boolean;
  isProcessingItem: boolean;
  isNextRequestItem: boolean;

  // Process data
  currentItemIndex: number;
  totalItems: number;
  transactionId?: number;
  currentBin?: BinData;
  currentItem?: ItemData;
  error?: Error;
  skipCurrentBin: boolean;
};
