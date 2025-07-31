export type User = {
  id: string;
  cloudId: string;
  loginId: string;
  role: string;
};

export type BinData = {
  id: number;
  cuId: number;
  lockId: number;
  isFailed: boolean;
  isLocked: number;
  countFailed: number;
  name: string;
  row: string;
};

export type Cabinet = {
  id: string;
  name: string;
};

export type ItemSpare = {
  id: string;
  action: 'issue' | 'return';
  changedQty: number;
  workOrders?: any[];
};

export type ItemData = {
  bin: BinData;
  cabinet?: Cabinet;
  spares?: ItemSpare[];
};

export type ProcessItemJobData = {
  action: 'issue' | 'return';
  user: User;
  data: ItemData[];
  requestQty: number;
  tabletId: string;
};

export type MqttMessage = {
  transactionId: number;
  protocol: string;
  deviceId: number;
  lockId: number;
  user: User;
  type: string;
  data: ItemData;
  isFinal: boolean;
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
