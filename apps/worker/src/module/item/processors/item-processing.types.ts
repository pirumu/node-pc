// import { PROCESS_ITEM_TYPE } from '@common/constants';
//
// import { ProcessBinData, ProcessCabinetData, ProcessDataResult, ProcessItemRequest, WorkingOrderData } from '../item.types';
//
// export type TransactionState = {
//   isCloseWarningPopup: boolean;
//   isProcessingItem: boolean;
//   isNextRequestItem: boolean;
// };
//
// export type TransactionContext = {
//   currentItemIndex: number;
//   totalItem: number;
//   items: ProcessItemRequest['data'];
//   user: ProcessItemRequest['user'];
//   transactionType: ProcessItemRequest['transactionType'];
//   state: TransactionState;
//   transactionId: string;
// };
//
// export type DevicePayload = {
//   id: string;
//   deviceNumId: number;
//   itemId: string;
//   portId: number;
//   hardwarePort: string;
//   name: string;
//   partNumber: string;
//   totalQty: number;
//   qty: number;
//   status: string;
// };
//
// export type LockOpenSuccessMessage = {
//   transactionType: PROCESS_ITEM_TYPE;
//   transactionId: string;
//   data: ProcessDataResult;
// };
//
// export type ProcessResult = {
//   isProcessingItem: boolean;
//   isNextRequestItem: boolean;
// };
//
// export type ProcessItemLog = { quantity: number; previousQty: number; currentQty: number; changedQty: number } & {
//   id: string;
//   name: string;
//   partNo: string;
//   materialNo: string;
//   itemTypeId: string;
//   type: string;
//   conditionName: string;
//   quantity: number;
//   previousQty: number;
//   currentQty: number;
//   changedQty: number;
//   workingOrders: WorkingOrderData[];
// };
//
// export type CalculationResult = {
//   processLog: {
//     cabinet: ProcessCabinetData;
//     bin: ProcessBinData;
//     spares: ProcessItemLog[];
//   };
//   isNextRequestItem: boolean;
//   damageItems: Array<{
//     deviceId: string;
//     binId: string;
//     damageQty: number;
//   }>;
// };
