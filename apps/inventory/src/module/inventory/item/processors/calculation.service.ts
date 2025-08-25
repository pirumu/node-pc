// import { CONDITION_TYPE, PROCESS_ITEM_TYPE } from '@common/constants';
// import { CuLockRequest } from '@culock/dto';
// import { Command, LOCK_STATUS, ProtocolType } from '@culock/protocols';
// import { CuResponse } from '@culock/protocols/cu';
// import { PublisherService, Transport } from '@framework/publisher';
// import { sleep } from '@framework/time/sleep';
// import { Inject, Injectable, Logger } from '@nestjs/common';
//
// import { IProcessItemRepository, PROCESS_ITEM_REPOSITORY_TOKEN } from '../repositories';
//
// import { CalculationResult, DevicePayload, LockOpenSuccessMessage, ProcessItemLog, ProcessResult } from './item-processing.types';
//
// // Constants
// const CALCULATION_CONFIG = {
//   HEARTBEAT_THRESHOLD: 30 * 1000,
//   LOCK_STATUS_TIMEOUT: 60 * 60 * 1000,
//   WAIT_TIMES: {
//     BEFORE_CALCULATION: 1000,
//     STATUS_POLLING: 1000, // TIME_WAIT from original
//     AFTER_LOCK_CHECK: 2000,
//   },
//   CONDITION_WORKING_ID: CONDITION_TYPE.WORKING,
// };
//
// const MQTT_TOPICS = {
//   PROCESS_ITEM_STATUS: 'process-item/status',
//   PROCESS_ITEM_ERROR: 'process-item/error',
// } as const;
//
// @Injectable()
// export class CalculationService {
//   private readonly _logger = new Logger(CalculationService.name);
//
//   constructor(
//     @Inject(PROCESS_ITEM_REPOSITORY_TOKEN) private readonly _processItemRepository: IProcessItemRepository,
//     private readonly _publisherService: PublisherService,
//   ) {}
//
//   // ==================== Public API =======================//
//
//   public async handleLockOpenSuccess(message: LockOpenSuccessMessage): Promise<ProcessResult> {
//     const startTime = new Date();
//     this._logger.log('Starting calculation process', { transId: message.transactionId, startTime });
//
//     try {
//       // 1. Emit processing started immediately
//       await this._publishProcessingStatus(message.transactionId, true, false);
//
//       // 2. Get current device state before changes
//       const currentDevices = await this._getOnlineDevices();
//       await sleep(CALCULATION_CONFIG.WAIT_TIMES.BEFORE_CALCULATION);
//
//       // 3. Wait for lock to close
//       await this._waitForLockClosure(message);
//
//       // 4. Calculate changes and process results
//       const calculationResult = await this._calculateAndProcessChanges(message, currentDevices);
//
//       // 5. Emit final status
//       const result: ProcessResult = {
//         isProcessingItem: false,
//         isNextRequestItem: calculationResult.isNextRequestItem,
//       };
//
//       await this._publishProcessingStatus(message.transactionId, result.isProcessingItem, result.isNextRequestItem);
//
//       const endTime = new Date();
//       this._logger.log('Calculation process completed', {
//         transId: message.transactionId,
//         duration: endTime.getTime() - startTime.getTime(),
//         result,
//       });
//
//       return result;
//     } catch (error) {
//       this._logger.error('Calculation process failed:', error);
//
//       // Emit error status
//       const errorResult: ProcessResult = { isProcessingItem: false, isNextRequestItem: false };
//       await this._publishProcessingStatus(message.transactionId, errorResult.isProcessingItem, errorResult.isNextRequestItem);
//
//       return errorResult;
//     }
//   }
//
//   // ==================== Private Methods =======================//
//
//   private async _getOnlineDevices(binId?: string): Promise<DevicePayload[]> {
//     try {
//       const devices = await this._processItemRepository.findDevicesWithPort(binId);
//
//       if (!devices || devices.length === 0) {
//         return [];
//       }
//
//       const onlineDevices = devices.filter(({ device }) => device.isAlive());
//
//       if (onlineDevices.length === 0) {
//         this._logger.warn('No online devices found');
//         return [];
//       }
//
//       // Transform to payload format
//       return onlineDevices.map(({ device, portPath }) => ({
//         id: device.id,
//         deviceNumId: device.deviceNumId,
//         hardwarePort: portPath || '',
//         name: device.description?.name || '',
//         partNumber: device.description?.partNumber || '',
//         portId: device.deviceNumId % 100,
//         totalQty: device.calcQuantity || 0,
//         qty: device.quantity + device.changeQty,
//         status: device.status || '',
//         itemId: device.itemId || '',
//       }));
//     } catch (error) {
//       this._logger.error('Failed to get online devices:', error);
//       return [];
//     }
//   }
//
//   private async _waitForLockClosure(message: LockOpenSuccessMessage): Promise<void> {
//     const startTime = new Date();
//     const timeout = CALCULATION_CONFIG.LOCK_STATUS_TIMEOUT;
//
//     this._logger.log(`Waiting for lock closure for device ${message.data.bin.cuId}`);
//
//     const lockStatusPayload = new CuLockRequest({
//       protocol: ProtocolType.CU,
//       deviceId: message.data.bin.cuId,
//       lockIds: [message.data.bin.lockId],
//       command: Command.GET_STATUS,
//     });
//
//     while (new Date().getTime() - startTime.getTime() < timeout) {
//       await sleep(CALCULATION_CONFIG.WAIT_TIMES.STATUS_POLLING);
//
//       try {
//         const response = await this._publisherService.publish<CuResponse>(Transport.TCP, 'cu/status', lockStatusPayload);
//         if (response.isSuccess && Object.values(response.lockStatuses || {}).every((s) => s === LOCK_STATUS.CLOSED)) {
//           this._logger.log(`All locks closed for device ${message.data.bin.cuId}`);
//           break;
//         }
//       } catch (error) {
//         this._logger.warn('Error checking lock status:', error);
//       }
//     }
//
//     await sleep(CALCULATION_CONFIG.WAIT_TIMES.AFTER_LOCK_CHECK);
//     this._logger.log('Lock closure wait completed', new Date());
//   }
//
//   private async _calculateAndProcessChanges(message: LockOpenSuccessMessage, currentDevices: DevicePayload[]): Promise<CalculationResult> {
//     // 1. Calculate item changes
//     const calculationResult = await this._calculateItemChanges(message, currentDevices);
//
//     // 2. Update transaction with results
//     await this._updateTransactionWithResults(message.transactionId, calculationResult);
//
//     // 3. Handle damage items if applicable
//     await this._handleDamageItems(message, calculationResult);
//
//     // 4. Handle errors if quantity mismatches
//     await this._handleQuantityMismatch(message, calculationResult);
//
//     return calculationResult;
//   }
//
//   private async _calculateItemChanges(message: LockOpenSuccessMessage, currentDevices: DevicePayload[]): Promise<CalculationResult> {
//     const { cabinet, bin, requestItems, storageItems } = message.data;
//     const items = [...requestItems, ...storageItems];
//
//     let isNextRequestItem = true;
//     const damageItems: Array<{ deviceId: string; binId: string; damageQty: number }> = [];
//
//     const processLog: CalculationResult['processLog'] = {
//       cabinet,
//       bin,
//       spares: [], // actual items
//     };
//
//     // Get new device states after lock closure
//     const newDevices = await this._getOnlineDevices(bin.id);
//
//     this._logger.log('Device comparison', {
//       currentCount: currentDevices.length,
//       newCount: newDevices.length,
//     });
//
//     if (newDevices.length > 0 && currentDevices.length > 0) {
//       for (const newDevice of newDevices) {
//         const currentDeviceIndex = currentDevices.findIndex((el) => el.id === newDevice.id);
//
//         if (currentDeviceIndex < 0) {
//           this._logger.warn('Current device not found for comparison', { deviceId: newDevice.id });
//           continue;
//         }
//
//         const currentDevice = currentDevices[currentDeviceIndex];
//         const item = items.find((item) => item.id === currentDevice.itemId);
//
//         if (!item) {
//           this._logger.warn('Item not found for device', {
//             deviceId: newDevice.id,
//             itemId: currentDevice.itemId,
//           });
//           continue;
//         }
//
//         const changedQty = newDevice.qty - item.preQty;
//         let actualQty;
//         if (message.transactionType === PROCESS_ITEM_TYPE.RETURN) {
//           actualQty = changedQty;
//         } else {
//           actualQty = Math.abs(changedQty);
//         }
//
//         const requestQty = item.requestQty;
//
//         const processItemLog: ProcessItemLog = {
//           id: item.id,
//           name: item.name,
//           partNo: item.partNo,
//           materialNo: item.materialNo,
//           itemTypeId: item.itemTypeId,
//           type: item.type,
//           conditionName: CALCULATION_CONFIG.CONDITION_WORKING_ID || CONDITION_TYPE.WORKING,
//           quantity: actualQty,
//           previousQty: item.preQty,
//           currentQty: newDevice.qty,
//           changedQty: changedQty,
//           workingOrders: [],
//         };
//
//         if (item.workingOrders && item.workingOrders.length > 0) {
//           processItemLog.workingOrders = item.workingOrders;
//         }
//
//         if (actualQty !== 0) {
//           processLog.spares.push(processItemLog);
//         }
//
//         // Check if actual quantity matches requested quantity
//         if (actualQty !== requestQty) {
//           isNextRequestItem = false;
//           this._logger.warn('Quantity mismatch detected', {
//             transactionId: message.transactionId,
//             itemId: item.id,
//             expected: requestQty,
//             actual: actualQty,
//             type: message.transactionType,
//           });
//         }
//
//         // Handle damage items for RETURN transactions
//         if (isNextRequestItem && message.transactionType === PROCESS_ITEM_TYPE.RETURN && requestQty !== 0) {
//           // if (item.conditionName !== 'normal') {
//           //   damageItems.push({
//           //     deviceId: currentDevice.id,
//           //     binId: bin.id,
//           //     damageQty: changedQty,
//           //   });
//           // }
//         }
//       }
//     }
//
//     return {
//       processLog,
//       isNextRequestItem,
//       damageItems,
//     };
//   }
//
//   private async _updateTransactionWithResults(transactionId: string, calculationResult: CalculationResult): Promise<void> {
//     try {
//       const transaction = await this._processItemRepository.findTransactionById(transactionId);
//
//       if (!transaction) {
//         throw new Error(`Transaction not found: ${transactionId}`);
//       }
//
//       if (calculationResult.processLog.spares.length > 0) {
//         const updatedLocationsTemp = [...transaction.locations, calculationResult.processLog];
//
//         await this._processItemRepository.updateTransaction(transactionId, { locationsTemp: updatedLocationsTemp });
//
//         this._logger.log('Transaction updated with calculation results', {
//           transactionId,
//           sparesCount: calculationResult.processLog.spares.length,
//         });
//       }
//     } catch (error) {
//       this._logger.error('Failed to update transaction with results:', error);
//       throw error;
//     }
//   }
//
//   private async _handleDamageItems(message: LockOpenSuccessMessage, calculationResult: CalculationResult): Promise<void> {
//     if (!calculationResult.isNextRequestItem || calculationResult.damageItems.length === 0) {
//       return;
//     }
//
//     try {
//       // Extract unique IDs for batch operations
//       const deviceIds = [...new Set(calculationResult.damageItems.map((item) => item.deviceId))];
//       const binIds = [...new Set(calculationResult.damageItems.map((item) => item.binId))];
//       const damageItemsQty = calculationResult.damageItems.map((item) => ({
//         deviceId: item.deviceId,
//         damageQty: item.damageQty,
//       }));
//
//       await Promise.all([
//         this._processItemRepository.updateDevicesDamageQty(deviceIds, damageItemsQty),
//         this._processItemRepository.updateBinsDamage(binIds),
//       ]);
//
//       this._logger.log('Damage items processed with batch operations', {
//         deviceCount: deviceIds.length,
//         binCount: binIds.length,
//         totalDamageItems: calculationResult.damageItems.length,
//         transId: message.transactionId,
//       });
//     } catch (error) {
//       this._logger.error('Failed to handle damage items:', error);
//       throw error;
//     }
//   }
//
//   private async _handleQuantityMismatch(message: LockOpenSuccessMessage, calculationResult: CalculationResult): Promise<void> {
//     if (calculationResult.isNextRequestItem) {
//       return; // No mismatch, everything is fine
//     }
//
//     try {
//       const transaction = await this._processItemRepository.findTransactionById(message.transactionId);
//
//       if (!transaction) {
//         throw new Error(`Transaction not found: ${message.transactionId}`);
//       }
//
//       // Prepare error data
//       const errorData = {
//         data: {
//           ...calculationResult.processLog,
//           requestItems: message.data.requestItems,
//         },
//       };
//
//       const processErrorData = {
//         isCloseWarningPopup: false,
//         type: transaction.type,
//         isNextRequestItem: calculationResult.isNextRequestItem,
//         transactionId: message.transactionId,
//       };
//
//       // Publish error events
//       await Promise.all([
//         this._publisherService.publish(Transport.MQTT, `${transaction.type}/error`, errorData),
//         this._publisherService.publish(Transport.MQTT, MQTT_TOPICS.PROCESS_ITEM_ERROR, processErrorData),
//       ]);
//
//       this._logger.warn('Quantity mismatch detected - error events published', {
//         transId: message.transactionId,
//         transactionType: transaction.type,
//       });
//     } catch (error) {
//       this._logger.error('Failed to handle quantity mismatch:', error);
//       throw error;
//     }
//   }
//
//   private async _publishProcessingStatus(txId: string, isProcessingItem: boolean, isNextRequestItem: boolean): Promise<void> {
//     try {
//       const statusData = { transactionId: txId, isProcessingItem, isNextRequestItem };
//       await this._publisherService.publish(Transport.MQTT, MQTT_TOPICS.PROCESS_ITEM_STATUS, statusData);
//
//       this._logger.debug('Processing status published', statusData);
//     } catch (error) {
//       this._logger.error('Failed to publish processing status:', error);
//     }
//   }
//
//   public async onLockOpenSuccess(payload: LockOpenSuccessMessage): Promise<ProcessResult> {
//     try {
//       this._logger.log('Received lock open success event', { timestamp: new Date(), payload });
//
//       return await this.handleLockOpenSuccess(payload);
//     } catch (error) {
//       this._logger.error('Failed to process lock open success event:', error);
//       const errorResult: ProcessResult = { isProcessingItem: false, isNextRequestItem: false };
//       await this._publishProcessingStatus(payload.transactionId, errorResult.isProcessingItem, errorResult.isNextRequestItem);
//
//       return errorResult;
//     }
//   }
// }
