// import {
//   ExecutionStep,
//   ItemEntity,
//   LOADCELL_STATUS,
//   LoadcellEntity,
//   TransactionEntity,
//   TransactionEventEntity,
//   TransactionStatus,
//   TransactionType,
//   UserEntity,
// } from '@dals/mongo/entities';
// import { EntityRepository, Reference } from '@mikro-orm/core';
// import { InjectRepository } from '@mikro-orm/nestjs';
// import { Injectable, Logger } from '@nestjs/common';
// import * as mqtt from 'mqtt';
//
// // Types for the service
// class BaselineWeight {
//   loadcellId: string;
//   weight: number;
//   quantity: number;
//   timestamp: Date;
// }
//
// class RealtimeUpdate {
//   transactionId: string;
//   stepId: string;
//   loadcellId: string;
//   currentQuantity: number;
//   quantityTaken: number;
//   expectedQuantity?: number;
//   discrepancy?: number;
//   timestamp: Date;
// }
//
// class StepError {
//   transactionId: string;
//   stepId: string;
//   type: 'QUANTITY_DISCREPANCY' | 'WEIGHT_INSTABILITY' | 'LOADCELL_ERROR' | 'BIN_OPEN_FAILURE';
//   message: string;
//   details: any;
//   actions: ('CONTINUE' | 'RETRY' | 'CANCEL')[];
// }
//
// class UserDecision {
//   transactionId: string;
//   stepId: string;
//   action: 'CONTINUE' | 'RETRY' | 'CANCEL';
//   reason?: string;
// }
//
// // Configuration constants
// const CONFIG = {
//   TOLERANCE_THRESHOLD: 0.1, // 10% tolerance
//   WEIGHT_STABILIZATION_TIME: 3000, // 3 seconds
//   REALTIME_INTERVAL: 100, // 100ms
//   MAX_RETRY_ATTEMPTS: 3,
//   BIN_OPEN_TIMEOUT: 30000, // 30 seconds
//   WEIGHT_READING_TIMEOUT: 60000, // 60 seconds
//   MQTT_RECONNECT_ATTEMPTS: 5,
// };
//
// @Injectable()
// export class IssueItemService {
//   public readonly logger = new Logger(IssueItemService.name);
//   public mqttClient: mqtt.MqttClient;
//   public realtimeTrackers: Map<string, NodeJS.Timeout> = new Map();
//   public pendingDecisions: Map<string, Promise<UserDecision>> = new Map();
//
//   constructor(
//     @InjectRepository(TransactionEntity)
//     public readonly transactionRepo: EntityRepository<TransactionEntity>,
//     @InjectRepository(TransactionEventEntity)
//     public readonly transactionEventRepo: EntityRepository<TransactionEventEntity>,
//     @InjectRepository(LoadcellEntity)
//     public readonly loadcellRepo: EntityRepository<LoadcellEntity>,
//     @InjectRepository(UserEntity)
//     public readonly userRepo: EntityRepository<UserEntity>,
//     @InjectRepository(ItemEntity)
//     public readonly itemRepo: EntityRepository<ItemEntity>,
//   ) {
//     this.initializeMqttClient();
//   }
//
//   public async initializeMqttClient(): Promise<void> {
//     let attempts = 0;
//
//     const connect = () => {
//       this.mqttClient = mqtt.connect('mqtt://localhost:1883', {
//         rejectUnauthorized: false,
//         connectTimeout: 5000,
//       });
//
//       this.mqttClient.on('connect', () => {
//         this.logger.log('MQTT connected successfully');
//         this.setupMqttSubscriptions();
//       });
//
//       this.mqttClient.on('error', (error) => {
//         this.logger.error('MQTT connection error:', error);
//         if (attempts < CONFIG.MQTT_RECONNECT_ATTEMPTS) {
//           attempts++;
//           setTimeout(connect, 2000 * attempts);
//         }
//       });
//
//       this.mqttClient.on('offline', () => {
//         this.logger.warn('MQTT client offline');
//       });
//     };
//
//     connect();
//   }
//
//   public setupMqttSubscriptions(): void {
//     // Bin closed detection
//     this.mqttClient.subscribe('bin/closed', (err) => {
//       if (err) {
//         this.logger.error('Failed to subscribe to bin/closed:', err);
//       }
//     });
//
//     // User decisions
//     this.mqttClient.subscribe('transaction/user-decision', (err) => {
//       if (err) {
//         this.logger.error('Failed to subscribe to transaction/user-decision:', err);
//       }
//     });
//
//     // Lock status responses
//     this.mqttClient.subscribe('lock/status-response', (err) => {
//       if (err) {
//         this.logger.error('Failed to subscribe to lock/status-response:', err);
//       }
//     });
//
//     this.mqttClient.on('message', this.handleMqttMessage.bind(this));
//   }
//
//   public async handleMqttMessage(topic: string, message: Buffer): Promise<void> {
//     try {
//       const data = JSON.parse(message.toString());
//
//       switch (topic) {
//         case 'bin/closed':
//           await this.handleBinClosed(data);
//           break;
//         case 'transaction/user-decision':
//           await this.handleUserDecision(data);
//           break;
//         case 'lock/status-response':
//           await this.handleLockStatusResponse(data);
//           break;
//       }
//     } catch (error) {
//       this.logger.error(`Error handling MQTT message on topic ${topic}:`, error);
//     }
//   }
//
//   /**
//    * Main entry point for issue item process
//    */
//   public async processIssueTransaction(userId: string, executionSteps: ExecutionStep[]): Promise<TransactionEntity> {
//     const transaction = await this.initializeTransaction(userId, executionSteps);
//
//     try {
//       // Pre-execution validation
//       await this.validateTransactionPreconditions(transaction);
//
//       // Start processing steps
//       transaction.status = TransactionStatus.PROCESSING;
//       await this.transactionRepo.getEntityManager().persistAndFlush(transaction);
//
//       await this.executeSteps(transaction);
//
//       return transaction;
//     } catch (error) {
//       this.logger.error('Transaction failed:', error);
//       transaction.status = TransactionStatus.FAILED;
//       transaction.lastError = {
//         message: error.message,
//         stack: error.stack,
//         timestamp: new Date(),
//       };
//       await this.transactionRepo.getEntityManager().persistAndFlush(transaction);
//       throw error;
//     }
//   }
//
//   public async initializeTransaction(userId: string, executionSteps: ExecutionStep[]): Promise<TransactionEntity> {
//     const user = await this.userRepo.findOne(userId);
//     if (!user) {
//       throw new Error(`User not found: ${userId}`);
//     }
//
//     const totalRequestQty = executionSteps.reduce((total, step) => {
//       return total + step.itemsToIssue.reduce((stepTotal, item) => stepTotal + item.requestQty, 0);
//     }, 0);
//
//     const transaction = new TransactionEntity({
//       type: TransactionType.ISSUE,
//       status: TransactionStatus.PENDING,
//       user: Reference.create(user),
//       totalRequestQty,
//       currentStepId: executionSteps[0]?.stepId || '',
//       executionSteps,
//       executionStepOutputs: [],
//     });
//
//     await this.transactionRepo.getEntityManager().persistAndFlush(transaction);
//     this.logger.log(`Transaction initialized: ${transaction.id}`);
//
//     return transaction;
//   }
//
//   public async validateTransactionPreconditions(transaction: TransactionEntity): Promise<void> {
//     const errors: string[] = [];
//
//     // Validate all loadcells are online and calibrated
//     for (const step of transaction.executionSteps) {
//       const allLoadcellIds = [...step.itemsToIssue.map((item) => item.loadcellId), ...step.keepTrackItems.map((item) => item.loadcellId)];
//
//       const uniqueLoadcellIds = [...new Set(allLoadcellIds)];
//
//       for (const loadcellId of uniqueLoadcellIds) {
//         const loadcell = await this.loadcellRepo.findOne(loadcellId);
//
//         if (!loadcell) {
//           errors.push(`Loadcell not found: ${loadcellId}`);
//           continue;
//         }
//
//         if (loadcell.state.status !== LOADCELL_STATUS.RUNNING) {
//           errors.push(`Loadcell ${loadcell.code} is not running (status: ${loadcell.state.status})`);
//         }
//
//         if (!loadcell.state.isCalibrated) {
//           errors.push(`Loadcell ${loadcell.code} is not calibrated`);
//         }
//
//         if (!this.isLoadcellOnline(loadcell)) {
//           errors.push(`Loadcell ${loadcell.code} is offline`);
//         }
//       }
//
//       // Validate items exist
//       for (const item of step.itemsToIssue) {
//         const itemEntity = await this.itemRepo.findOne(item.itemId);
//         if (!itemEntity) {
//           errors.push(`Item not found: ${item.itemId}`);
//         }
//       }
//     }
//
//     if (errors.length > 0) {
//       throw new Error(`Transaction validation failed: ${errors.join(', ')}`);
//     }
//   }
//
//   public isLoadcellOnline(loadcell: LoadcellEntity): boolean {
//     const now = Date.now();
//     const lastHeartbeat = loadcell.heartbeat * 1000; // Convert to milliseconds
//     return now - lastHeartbeat < 30000; // 30 seconds tolerance
//   }
//
//   public async executeSteps(transaction: TransactionEntity): Promise<void> {
//     for (let i = 0; i < transaction.executionSteps.length; i++) {
//       const step = transaction.executionSteps[i];
//       transaction.setCurrentStepId(step.stepId);
//       await this.transactionRepo.getEntityManager().persistAndFlush(transaction);
//
//       let retryCount = 0;
//       let isStepCompleted = false;
//
//       while (!isStepCompleted && retryCount < CONFIG.MAX_RETRY_ATTEMPTS) {
//         try {
//           await this.executeStep(transaction, step);
//           isStepCompleted = true;
//         } catch (error) {
//           this.logger.error(`Step ${step.stepId} failed (attempt ${retryCount + 1}):`, error);
//           retryCount++;
//
//           if (retryCount >= CONFIG.MAX_RETRY_ATTEMPTS) {
//             throw new Error(`Step ${step.stepId} failed after ${CONFIG.MAX_RETRY_ATTEMPTS} attempts: ${error.message}`);
//           }
//
//           // Wait before retry
//           await this.wait(2000 * retryCount);
//         }
//       }
//     }
//
//     // Mark transaction as completed
//     const hasErrors = transaction.executionStepOutputs.some((output) => output.hasErrors);
//     transaction.status = hasErrors ? TransactionStatus.COMPLETED_WITH_ERROR : TransactionStatus.COMPLETED;
//     transaction.completedAt = new Date();
//     await this.transactionRepo.getEntityManager().persistAndFlush(transaction);
//
//     this.publishMqtt('transaction/completed', {
//       transactionId: transaction.id,
//       status: transaction.status,
//       totalEvents: await this.transactionEventRepo.count({ transaction: transaction.id }),
//     });
//
//     this.logger.log(`Transaction completed: ${transaction.id} with status: ${transaction.status}`);
//   }
//
//   public async executeStep(transaction: TransactionEntity, step: ExecutionStep): Promise<void> {
//     this.logger.log(`Executing step: ${step.stepId} for bin: ${step.binId}`);
//
//     // Get all loadcells for this step
//     const allLoadcellIds = [...step.itemsToIssue.map((item) => item.loadcellId), ...step.keepTrackItems.map((item) => item.loadcellId)];
//     const uniqueLoadcellIds = [...new Set(allLoadcellIds)];
//
//     const loadcells = await this.loadcellRepo.find({ id: { $in: uniqueLoadcellIds } });
//
//     if (loadcells.length !== uniqueLoadcellIds.length) {
//       throw new Error(`Some loadcells not found for step ${step.stepId}`);
//     }
//
//     // Capture baseline weights
//     const baselineWeights = await this.captureBaselineWeights(loadcells);
//
//     // Open bin and start monitoring
//     await this.openBinAndStartMonitoring(transaction, step, loadcells, baselineWeights);
//   }
//
//   public async captureBaselineWeights(loadcells: LoadcellEntity[]): Promise<Map<string, BaselineWeight>> {
//     const baselineWeights = new Map<string, BaselineWeight>();
//
//     for (const loadcell of loadcells) {
//       // Ensure we have fresh weight reading
//       await this.ensureFreshWeightReading(loadcell);
//
//       baselineWeights.set(loadcell.id, {
//         loadcellId: loadcell.id,
//         weight: loadcell.reading.currentWeight,
//         quantity: loadcell.calibration.quantity,
//         timestamp: new Date(),
//       });
//     }
//
//     return baselineWeights;
//   }
//
//   public async ensureFreshWeightReading(loadcell: LoadcellEntity): Promise<void> {
//     const startTime = Date.now();
//
//     while (Date.now() - startTime < CONFIG.WEIGHT_READING_TIMEOUT) {
//       // Refresh loadcell entity
//       await this.loadcellRepo.getEntityManager().refresh(loadcell);
//
//       // Check if we have a recent reading (within last 2 seconds)
//       const readingAge = Date.now() - (loadcell.state.isUpdatedWeight ? Date.now() : 0);
//       if (readingAge < 2000) {
//         return;
//       }
//
//       await this.wait(500);
//     }
//
//     throw new Error(`Fresh weight reading timeout for loadcell ${loadcell.code}`);
//   }
//
//   public async openBinAndStartMonitoring(
//     transaction: TransactionEntity,
//     step: ExecutionStep,
//     loadcells: LoadcellEntity[],
//     baselineWeights: Map<string, BaselineWeight>,
//   ): Promise<void> {
//     // Send bin open command
//     this.publishMqtt('bin/open', {
//       transactionId: transaction.id,
//       stepId: step.stepId,
//       binId: step.binId,
//       baselineWeights: Array.from(baselineWeights.values()),
//     });
//
//     // Open physical lock
//     const isLockOpened = await this.openBinLock(step.binId);
//     if (!isLockOpened) {
//       throw new Error(`Failed to open bin lock: ${step.binId}`);
//     }
//
//     // Start realtime monitoring
//     this.startRealtimeTracking(transaction, step, loadcells, baselineWeights);
//
//     // Wait for bin to be closed
//     await this.waitForBinClosed(transaction.id, step.stepId);
//   }
//
//   public async openBinLock(binId: string): Promise<boolean> {
//     return new Promise((resolve) => {
//       const timeout = setTimeout(() => {
//         resolve(false);
//       }, CONFIG.BIN_OPEN_TIMEOUT);
//
//       // Send lock open command
//       this.publishMqtt('lock/open', {
//         binId: binId,
//         timestamp: new Date(),
//       });
//
//       // Wait for confirmation (this would be handled by lock/status-response)
//       // For now, simulate successful opening after a delay
//       setTimeout(() => {
//         clearTimeout(timeout);
//         resolve(true);
//       }, 2000);
//     });
//   }
//
//   public startRealtimeTracking(
//     transaction: TransactionEntity,
//     step: ExecutionStep,
//     loadcells: LoadcellEntity[],
//     baselineWeights: Map<string, BaselineWeight>,
//   ): void {
//     const trackingKey = `${transaction.id}-${step.stepId}`;
//
//     // Stop any existing tracking for this step
//     this.stopRealtimeTracking(trackingKey);
//
//     const interval = setInterval(async () => {
//       try {
//         for (const loadcell of loadcells) {
//           await this.loadcellRepo.getEntityManager().refresh(loadcell);
//
//           const baseline = baselineWeights.get(loadcell.id);
//           if (!baseline) {
//             continue;
//           }
//
//           const currentWeight = loadcell.reading.currentWeight;
//           const currentQuantity = this.calculateQuantity(currentWeight, loadcell.calibration);
//
//           const quantityChange = baseline.quantity - currentQuantity;
//           const quantityTaken = Math.abs(quantityChange);
//
//           // Find expected item for this loadcell
//           const expectedItem = step.itemsToIssue.find((item) => item.loadcellId === loadcell.id);
//
//           const update: RealtimeUpdate = {
//             transactionId: transaction.id,
//             stepId: step.stepId,
//             loadcellId: loadcell.id,
//             currentQuantity,
//             quantityTaken,
//             timestamp: new Date(),
//           };
//
//           if (expectedItem) {
//             const discrepancy = quantityTaken - expectedItem.requestQty;
//             update.expectedQuantity = expectedItem.requestQty;
//             update.discrepancy = discrepancy;
//
//             // Check for immediate discrepancy
//             if (quantityTaken > 0 && Math.abs(discrepancy) / expectedItem.requestQty > CONFIG.TOLERANCE_THRESHOLD) {
//               this.publishMqtt('transaction/warning', {
//                 transactionId: transaction.id,
//                 stepId: step.stepId,
//                 type: 'QUANTITY_DISCREPANCY',
//                 loadcellId: loadcell.id,
//                 expected: expectedItem.requestQty,
//                 actual: quantityTaken,
//                 discrepancy: discrepancy,
//                 message: `Quantity mismatch detected for ${expectedItem.name}. Expected: ${expectedItem.requestQty}, Actual: ${quantityTaken}`,
//                 timestamp: new Date(),
//               });
//             }
//           }
//
//           // Send realtime update
//           this.publishMqtt('transaction/realtime-update', update);
//         }
//       } catch (error) {
//         this.logger.error('Error in realtime tracking:', error);
//       }
//     }, CONFIG.REALTIME_INTERVAL);
//
//     this.realtimeTrackers.set(trackingKey, interval);
//   }
//
//   public stopRealtimeTracking(trackingKey: string): void {
//     const interval = this.realtimeTrackers.get(trackingKey);
//     if (interval) {
//       clearInterval(interval);
//       this.realtimeTrackers.delete(trackingKey);
//     }
//   }
//
//   public calculateQuantity(weight: number, calibration: any): number {
//     if (calibration.unitWeight <= 0) {
//       throw new Error('Invalid unit weight for quantity calculation');
//     }
//
//     const adjustedWeight = Math.max(0, weight - calibration.zeroWeight);
//     return Math.floor(adjustedWeight / calibration.unitWeight);
//   }
//
//   public async waitForBinClosed(transactionId: string, stepId: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//       const timeout = setTimeout(() => {
//         reject(new Error(`Bin close timeout for step ${stepId}`));
//       }, CONFIG.WEIGHT_READING_TIMEOUT);
//
//       // This will be resolved by handleBinClosed method
//       const checkClosed = async () => {
//         // Check if step is completed (this would be set by handleBinClosed)
//         const transaction = await this.transactionRepo.findOne(transactionId);
//         const stepOutput = transaction.executionStepOutputs.find((output) => output.stepId === stepId);
//
//         if (stepOutput) {
//           clearTimeout(timeout);
//           resolve();
//         } else {
//           setTimeout(checkClosed, 1000);
//         }
//       };
//
//       setTimeout(checkClosed, 1000);
//     });
//   }
//
//   public async handleBinClosed(data: any): Promise<void> {
//     const { transactionId, stepId } = data;
//
//     try {
//       const transaction = await this.transactionRepo.findOne(transactionId);
//       if (!transaction) {
//         this.logger.error(`Transaction not found: ${transactionId}`);
//         return;
//       }
//
//       const step = transaction.executionSteps.find((s) => s.stepId === stepId);
//       if (!step) {
//         this.logger.error(`Step not found: ${stepId}`);
//         return;
//       }
//
//       // Stop realtime tracking
//       const trackingKey = `${transactionId}-${stepId}`;
//       this.stopRealtimeTracking(trackingKey);
//
//       // Wait for weight stabilization
//       await this.wait(CONFIG.WEIGHT_STABILIZATION_TIME);
//
//       // Process final calculations
//       await this.processFinalCalculations(transaction, step);
//     } catch (error) {
//       this.logger.error('Error handling bin closed:', error);
//     }
//   }
//
//   public async processFinalCalculations(transaction: TransactionEntity, step: ExecutionStep): Promise<void> {
//     const allLoadcellIds = [...step.itemsToIssue.map((item) => item.loadcellId), ...step.keepTrackItems.map((item) => item.loadcellId)];
//     const uniqueLoadcellIds = [...new Set(allLoadcellIds)];
//
//     const loadcells = await this.loadcellRepo.find({ id: { $in: uniqueLoadcellIds } });
//     const transactionEvents: TransactionEventEntity[] = [];
//     let hasErrors = false;
//
//     for (const loadcell of loadcells) {
//       // Ensure fresh reading after stabilization
//       await this.ensureFreshWeightReading(loadcell);
//
//       const finalWeight = loadcell.reading.currentWeight;
//       const finalQuantity = this.calculateQuantity(finalWeight, loadcell.calibration);
//
//       // Find corresponding items
//       const itemsForLoadcell = step.itemsToIssue.filter((item) => item.loadcellId === loadcell.id);
//       const trackItemsForLoadcell = step.keepTrackItems.filter((item) => item.loadcellId === loadcell.id);
//
//       // Calculate total expected change for this loadcell
//       const totalExpectedChange = itemsForLoadcell.reduce((sum, item) => sum + item.requestQty, 0);
//
//       // Get baseline (assuming we stored it somewhere accessible)
//       // For this implementation, we'll need to recalculate or store baseline
//       const quantityBefore = loadcell.calibration.quantity; // This should be the baseline
//       const quantityAfter = finalQuantity;
//       const actualQuantityChanged = quantityBefore - quantityAfter;
//
//       // Create events for each item
//       for (const itemToTake of itemsForLoadcell) {
//         const item = await this.itemRepo.findOne(itemToTake.itemId);
//         if (!item) {
//           continue;
//         }
//
//         const proportionalChange = totalExpectedChange > 0 ? (itemToTake.requestQty / totalExpectedChange) * actualQuantityChanged : 0;
//
//         const event = new TransactionEventEntity({
//           transaction: Reference.create(transaction),
//           loadcell: Reference.create(loadcell),
//           item: Reference.create(item),
//           itemSnapshot: {
//             name: itemToTake.name,
//             partNo: item.partNo || '',
//           },
//           locationSnapshot: this.createLocationSnapshot(loadcell),
//           quantityBefore: quantityBefore,
//           quantityAfter: quantityAfter,
//           quantityChanged: Math.round(proportionalChange),
//         });
//
//         transactionEvents.push(event);
//
//         // Check for discrepancy
//         const discrepancy = Math.abs(Math.abs(proportionalChange) - itemToTake.requestQty);
//         if (discrepancy / itemToTake.requestQty > CONFIG.TOLERANCE_THRESHOLD) {
//           hasErrors = true;
//         }
//       }
//
//       // Update loadcell quantity
//       loadcell.calibration.quantity = finalQuantity;
//       await this.loadcellRepo.getEntityManager().persistAndFlush(loadcell);
//     }
//
//     // Save all transaction events
//     await this.transactionEventRepo.getEntityManager().persistAndFlush(transactionEvents);
//
//     // Add step output
//     const stepOutput = {
//       stepId: step.stepId,
//       binId: step.binId,
//       events: transactionEvents.map((e) => e.id),
//       timestamp: new Date(),
//       hasErrors: hasErrors,
//     };
//
//     transaction.addOutput(stepOutput);
//     await this.transactionRepo.getEntityManager().persistAndFlush(transaction);
//
//     if (hasErrors) {
//       // Show error popup and wait for user decision
//       await this.handleStepError(transaction, step, transactionEvents);
//     }
//   }
//
//   public createLocationSnapshot(loadcell: LoadcellEntity): any {
//     return {
//       siteId: loadcell.site.id || '',
//       siteName: loadcell.site.name || '',
//       clusterId: loadcell.cluster?.id || '',
//       clusterName: loadcell.cluster?.name || '',
//       cabinetId: loadcell.cabinet?.id || '',
//       cabinetName: loadcell.cabinet?.name || '',
//       binId: loadcell.bin?.id || '',
//       binName: loadcell.bin?.x + '-' + loadcell.bin?.y,
//       loadcellCode: loadcell.code,
//     };
//   }
//
//   public async handleStepError(transaction: TransactionEntity, step: ExecutionStep, events: TransactionEventEntity[]): Promise<void> {
//     const error: StepError = {
//       transactionId: transaction.id,
//       stepId: step.stepId,
//       type: 'QUANTITY_DISCREPANCY',
//       message: 'Quantity discrepancy detected in step execution',
//       details: {
//         events: events.map((e) => ({
//           itemName: e.itemSnapshot.name,
//           expected: step.itemsToIssue.find((i) => i.itemId === e.item.id)?.requestQty || 0,
//           actual: Math.abs(e.quantityChanged),
//           discrepancy: Math.abs(e.quantityChanged) - (step.itemsToIssue.find((i) => i.itemId === e.item.id)?.requestQty || 0),
//         })),
//       },
//       actions: ['CONTINUE', 'RETRY', 'CANCEL'],
//     };
//
//     this.publishMqtt('transaction/step-error', error);
//
//     // Wait for user decision
//     const decision = await this.waitForUserDecision(transaction.id, step.stepId);
//
//     switch (decision.action) {
//       case 'CONTINUE':
//         this.logger.log(`User chose to continue step ${step.stepId} despite errors`);
//         break;
//       case 'RETRY':
//         this.logger.log(`User chose to retry step ${step.stepId}`);
//         throw new Error('RETRY_STEP'); // This will cause the step to be retried
//       case 'CANCEL':
//         this.logger.log(`User chose to cancel transaction ${transaction.id}`);
//         transaction.status = TransactionStatus.CANCELLED;
//         await this.transactionRepo.getEntityManager().persistAndFlush(transaction);
//         throw new Error('TRANSACTION_CANCELLED');
//     }
//   }
//
//   public async waitForUserDecision(transactionId: string, stepId: string): Promise<UserDecision> {
//     const decisionKey = `${transactionId}-${stepId}`;
//
//     return new Promise((resolve, reject) => {
//       const timeout = setTimeout(() => {
//         this.pendingDecisions.delete(decisionKey);
//         reject(new Error('User decision timeout'));
//       }, 300000); // 5 minutes timeout
//
//       const decisionPromise = new Promise<UserDecision>((decisionResolve) => {
//         this.pendingDecisions.set(decisionKey, decisionPromise);
//
//         // The resolution will be handled by handleUserDecision method
//         const checkDecision = () => {
//           // This is a placeholder - actual implementation would use events/callbacks
//           setTimeout(checkDecision, 1000);
//         };
//         checkDecision();
//       });
//
//       decisionPromise
//         .then((decision) => {
//           clearTimeout(timeout);
//           this.pendingDecisions.delete(decisionKey);
//           resolve(decision);
//         })
//         .catch(reject);
//     });
//   }
//
//   public async handleUserDecision(data: UserDecision): Promise<void> {
//     const decisionKey = `${data.transactionId}-${data.stepId}`;
//     const pendingPromise = this.pendingDecisions.get(decisionKey);
//
//     if (pendingPromise) {
//       // Resolve the pending decision
//       // In a real implementation, you'd need a way to resolve the promise
//       // This might involve using EventEmitter or similar pattern
//       this.logger.log(`User decision received: ${JSON.stringify(data)}`);
//     }
//   }
//
//   public async handleLockStatusResponse(data: any): Promise<void> {
//     // Handle lock status responses for better error handling
//     this.logger.log(`Lock status response: ${JSON.stringify(data)}`);
//   }
//
//   public publishMqtt(topic: string, data: any): void {
//     if (this.mqttClient?.connected) {
//       this.mqttClient.publish(topic, JSON.stringify(data));
//     } else {
//       this.logger.error(`MQTT not connected, cannot publish to ${topic}`);
//     }
//   }
//
//   public async wait(ms: number): Promise<void> {
//     return new Promise((resolve) => setTimeout(resolve, ms));
//   }
//
//   // Cleanup method
//   onModuleDestroy() {
//     // Clean up all realtime trackers
//     for (const [key, interval] of this.realtimeTrackers) {
//       clearInterval(interval);
//     }
//     this.realtimeTrackers.clear();
//
//     // Close MQTT connection
//     if (this.mqttClient) {
//       this.mqttClient.end();
//     }
//   }
// }
