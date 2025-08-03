export type IssueItemTransactionContext = {
  action: string;
  user: any;
  data: any[];
  requestQty: number;
  tabletDeviceId: string;
  transactionId?: string;
  currentIndex: number;
  deviceList: any[];
  isProcessingItem: boolean;
  isNextRequestItem: boolean;
  isCloseWarningPopup: boolean;
  retryCount: number;
  error?: string;
};

export type TransactionEvent =
  | { type: 'START'; action: string; user: any; data: any[]; requestQty: number; tabletDeviceId: string }
  | { type: 'LOCK_OPEN_SUCCESS'; message: any }
  | { type: 'LOCK_OPEN_FAIL'; message: any }
  | { type: 'BIN_OPEN_FAIL'; message: any }
  | { type: 'PROCESS_ITEM_STATUS'; message: any }
  | { type: 'PROCESS_ITEM_ERROR'; message: any }
  | { type: 'xstate.done.actor.createTransaction'; output: { transactionId: string } }
  | { type: 'xstate.done.actor.getDeviceList'; output: any[] };

export type CreateTransactionInput = {
  action: string;
  user: any;
  requestQty: number;
  tabletDeviceId: string;
};

export type GetDeviceListInput = {
  binId: string;
  itemId: string;
};

export type PrepareBinInput = {
  bin: any;
  user: any;
};

export type OpenLockInput = {
  bin: any;
  user: any;
  action: string;
  transactionId?: string;
};

export type ProcessTransactionInput = {
  data: any[];
  currentIndex: number;
  deviceList: any[];
  transactionId?: string;
  action: string;
  user: any;
};

export type FinalizeTransactionInput = {
  transactionId: string;
};
