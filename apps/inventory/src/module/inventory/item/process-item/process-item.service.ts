import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { MqttService } from '../mqtt/mqtt.service';
import { StateManagerService } from './state-manager.service';
import { ProcessItemStateMachine, ProcessState, ProcessEvent } from './process-item.state-machine';
import { TransactionService } from '../transaction/transaction.service';
import { BinService } from '../bin/bin.service';
import { DeviceService } from '../device/device.service';
import axios from 'axios';
import * as https from 'https';

@Injectable()
export class ProcessItemService {
  private readonly logger = new Logger(ProcessItemService.name);

  constructor(
    @InjectQueue('process-item') private processQueue: Queue,
    private readonly mqttService: MqttService,
    private readonly stateManager: StateManagerService,
    private readonly wsGateway: WebSocketGateway,
    private readonly transactionService: TransactionService,
    private readonly binService: BinService,
    private readonly deviceService: DeviceService,
  ) {}

  async createJob(data: ProcessItemJobData): Promise<Job> {
    const job = await this.processQueue.add(data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    this.logger.log(`Created job ${job.id} for ${data.type} process`);
    return job;
  }

  async processItems(job: Job<ProcessItemJobData>): Promise<void> {
    const { data } = job;
    const stateMachine = new ProcessItemStateMachine(job.id.toString(), data.data.length);

    // Register state machine
    this.stateManager.registerStateMachine(job.id.toString(), stateMachine);

    // Setup event listeners
    this.setupStateMachineListeners(stateMachine);

    try {
      // Start processing
      stateMachine.transition(ProcessEvent.START);

      // Connect MQTT and setup handlers
      await this.setupMqttHandlers(stateMachine, data);
      stateMachine.transition(ProcessEvent.MQTT_CONNECTED);

      // Create transaction
      const transaction = await this.transactionService.createTransaction(data);
      stateMachine.transition(ProcessEvent.MQTT_CONNECTED, { transactionId: transaction.id });

      // Process each item
      while (stateMachine.getContext().currentItemIndex < data.data.length) {
        const state = stateMachine.getState();

        if (state === ProcessState.ERROR || state === ProcessState.COMPLETED) {
          break;
        }

        if (state === ProcessState.CONNECTED) {
          await this.processNextItem(stateMachine, data, transaction.id);
        } else {
          // Wait for state to change
          await this.wait(100);
        }
      }

      // Complete transaction if all items processed
      if (stateMachine.getContext().currentItemIndex >= data.data.length) {
        stateMachine.transition(ProcessEvent.ALL_ITEMS_PROCESSED);
        await this.transactionService.completeTransaction(transaction.id);
      }
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}:`, error);
      stateMachine.transition(ProcessEvent.ERROR_OCCURRED, { error });
      throw error;
    } finally {
      // Cleanup
      this.cleanupStateMachine(job.id.toString());
    }
  }

  private setupStateMachineListeners(stateMachine: ProcessItemStateMachine): void {
    // Listen to state changes
    stateMachine.on('stateChange', (event) => {
      this.handleStateChange(event);
    });

    // Listen to flag updates
    stateMachine.on('flagUpdate', (event) => {
      this.handleFlagUpdate(event);
    });
  }

  private handleStateChange(event: StateChangeEvent): void {
    // Publish to MQTT
    this.mqttService.publish('process-item/state', {
      jobId: event.jobId,
      state: event.currentState,
      previousState: event.previousState,
      flags: {
        isProcessingItem: event.context.isProcessingItem,
        isCloseWarningPopup: event.context.isCloseWarningPopup,
        isNextRequestItem: event.context.isNextRequestItem,
      },
      progress: {
        current: event.context.currentItemIndex,
        total: event.context.totalItems,
      },
      timestamp: event.timestamp,
    });

    // Emit via WebSocket
    this.wsGateway.broadcastStateUpdate({
      jobId: event.jobId,
      state: event.currentState,
      flags: {
        isProcessingItem: event.context.isProcessingItem,
        isCloseWarningPopup: event.context.isCloseWarningPopup,
        isNextRequestItem: event.context.isNextRequestItem,
      },
      progress: {
        current: event.context.currentItemIndex,
        total: event.context.totalItems,
      },
    });
  }

  private handleFlagUpdate(event: FlagUpdateEvent): void {
    // Publish specific flag update to MQTT
    this.mqttService.publish(`process-item/flag/${event.flag}`, {
      jobId: event.jobId,
      flag: event.flag,
      value: event.value,
      timestamp: event.timestamp,
    });

    // Also publish to job-specific topic
    this.mqttService.publish(`job/${event.jobId}/process-item/status`, {
      [event.flag]: event.value,
      timestamp: event.timestamp,
    });
  }

  private async setupMqttHandlers(stateMachine: ProcessItemStateMachine, jobData: ProcessItemJobData): Promise<void> {
    const jobId = stateMachine.getContext().jobId;

    // Subscribe to job-specific topics
    this.mqttService.subscribe(`job/${jobId}/bin/openFail`, async (data) => {
      await this.handleBinOpenFail(stateMachine, data);
    });

    this.mqttService.subscribe(`job/${jobId}/process-item/error`, (data) => {
      if (data.isCloseWarningPopup !== undefined) {
        stateMachine.updateFlag('isCloseWarningPopup', data.isCloseWarningPopup);
      }
      if (data.isNextRequestItem !== undefined) {
        stateMachine.updateFlag('isNextRequestItem', data.isNextRequestItem);
      }
    });

    this.mqttService.subscribe(`job/${jobId}/process-item/status`, (data) => {
      const state = stateMachine.getState();

      // Handle user actions based on flags
      if (data.isCloseWarningPopup !== undefined) {
        stateMachine.updateFlag('isCloseWarningPopup', data.isCloseWarningPopup);
      }

      if (data.isNextRequestItem !== undefined) {
        stateMachine.updateFlag('isNextRequestItem', data.isNextRequestItem);
      }

      // Handle user completion
      if (!data.isProcessingItem && (state === ProcessState.BIN_OPENED || state === ProcessState.WAITING_USER_ACTION)) {
        stateMachine.transition(ProcessEvent.USER_ACTION_COMPLETE);
      }
    });

    // Subscribe to lock events
    this.mqttService.subscribe('lock/openSuccess', (data) => {
      if (data.transId === stateMachine.getContext().transactionId) {
        this.logger.log(`Lock opened successfully for job ${jobId}`);
      }
    });

    this.mqttService.subscribe('lock/openFail', (data) => {
      if (data.transId === stateMachine.getContext().transactionId) {
        this.logger.warn(`Lock open failed for job ${jobId}`);
      }
    });
  }

  private async processNextItem(stateMachine: ProcessItemStateMachine, jobData: ProcessItemJobData, transactionId: number): Promise<void> {
    const context = stateMachine.getContext();
    const item = jobData.data[context.currentItemIndex];

    this.logger.log(`Processing item ${context.currentItemIndex + 1}/${context.totalItems}`);

    stateMachine.transition(ProcessEvent.NEXT_ITEM);

    const bin = await this.binService.findById(item.bin.id);

    if (bin.is_failed) {
      this.logger.warn(`Bin ${bin.id} is failed, skipping`);
      stateMachine.transition(ProcessEvent.BIN_OPEN_FAIL, {
        currentItemIndex: context.currentItemIndex + 1,
      });
      return;
    }

    // Update device zero weight
    await this.deviceService.updateZeroWeight(bin.id);

    // Open bin
    const success = await this.openBin(stateMachine, jobData, item, bin, transactionId);

    if (success) {
      // Wait for user action
      await this.waitForUserAction(stateMachine);

      // Close bin and update
      await this.closeBinAndUpdate(stateMachine, jobData, item, bin, transactionId);
    }
  }

  private async openBin(
    stateMachine: ProcessItemStateMachine,
    jobData: ProcessItemJobData,
    item: ItemData,
    bin: BinData,
    transactionId: number,
  ): Promise<boolean> {
    const context = stateMachine.getContext();
    const mqttData: MqttMessage = {
      deviceType: 'CU',
      deviceId: bin.cu_id,
      lockId: bin.lock_id,
      user: jobData.user,
      type: jobData.type,
      data: item,
      transId: transactionId,
      is_final: context.currentItemIndex === jobData.data.length - 1,
      jobId: context.jobId,
    };

    // Publish bin open event
    this.mqttService.publish('bin/open', mqttData);
    await this.wait(1500);

    // Call lock API
    try {
      const response = await this.callLockApi(jobData.token, bin);

      if (!response.data.results.length) {
        return await this.handleLockFailure(stateMachine, bin, item);
      }

      // Success
      await this.binService.updateBinStatus(bin.id, { is_locked: 0, count_failed: 0 });
      this.mqttService.publish('lock/openSuccess', mqttData);
      stateMachine.transition(ProcessEvent.BIN_OPEN_SUCCESS, { currentBin: bin });

      return true;
    } catch (error) {
      this.logger.error('Error opening lock:', error);
      stateMachine.transition(ProcessEvent.ERROR_OCCURRED, { error });
      return false;
    }
  }

  private async handleLockFailure(stateMachine: ProcessItemStateMachine, bin: BinData, item: ItemData): Promise<boolean> {
    const updatedBin = await this.binService.incrementFailCount(bin.id);

    if (updatedBin.is_failed || updatedBin.count_failed >= 3) {
      this.logger.warn(`Bin ${bin.id} exceeded failure limit, skipping`);
      stateMachine.transition(ProcessEvent.BIN_OPEN_FAIL, {
        currentItemIndex: stateMachine.getContext().currentItemIndex + 1,
      });
      return false;
    }

    // Emit failure event
    const context = stateMachine.getContext();
    this.mqttService.publish('lock/openFail', {
      ...item,
      jobId: context.jobId,
      transId: context.transactionId,
    });

    // Wait for user decision
    stateMachine.updateFlag('isCloseWarningPopup', false);

    // Wait for user to close warning or skip
    const startTime = Date.now();
    const timeout = 60000; // 1 minute timeout

    while (Date.now() - startTime < timeout) {
      const updatedBin = await this.binService.findById(bin.id);
      const context = stateMachine.getContext();

      if (updatedBin.is_locked === 0) {
        // Lock was opened manually
        stateMachine.transition(ProcessEvent.BIN_OPEN_SUCCESS, { currentBin: bin });
        return true;
      }

      if (updatedBin.is_failed || updatedBin.count_failed >= 3 || !context.shouldContinue) {
        // Skip this bin
        stateMachine.transition(ProcessEvent.BIN_OPEN_FAIL, {
          currentItemIndex: context.currentItemIndex + 1,
        });
        return false;
      }

      await this.wait(1000);
    }

    // Timeout - skip
    stateMachine.transition(ProcessEvent.BIN_OPEN_FAIL, {
      currentItemIndex: stateMachine.getContext().currentItemIndex + 1,
    });
    return false;
  }

  private async waitForUserAction(stateMachine: ProcessItemStateMachine): Promise<void> {
    stateMachine.waitForUserAction();

    // Wait until user completes action
    while (stateMachine.getState() === ProcessState.BIN_OPENED || stateMachine.getState() === ProcessState.WAITING_USER_ACTION) {
      await this.wait(100);
    }
  }

  private async closeBinAndUpdate(
    stateMachine: ProcessItemStateMachine,
    jobData: ProcessItemJobData,
    item: ItemData,
    bin: BinData,
    transactionId: number,
  ): Promise<void> {
    // Update bin status
    await this.binService.updateBinStatus(bin.id, { is_locked: 1 });

    // Emit close event
    const context = stateMachine.getContext();
    this.mqttService.publish('bin/close', {
      binId: bin.id,
      transId: transactionId,
      jobId: context.jobId,
    });

    stateMachine.transition(ProcessEvent.BIN_CLOSED);

    // Wait for warning popup if needed
    while (!context.warningPopupClosed) {
      await this.wait(100);
    }

    // Update transaction
    await this.transactionService.updateLocations(transactionId);

    // Update return items based on type
    if (jobData.type === 'issue') {
      await this.transactionService.updateReturnItemsForIssue(transactionId, jobData.user.id, bin.id);
    } else {
      await this.transactionService.updateReturnItemsForReturn(transactionId, jobData.user.id, bin.id);
    }

    stateMachine.transition(ProcessEvent.TRANSACTION_UPDATED, {
      currentItemIndex: context.currentItemIndex + 1,
    });
  }

  private cleanupStateMachine(jobId: string): void {
    const machine = this.stateManager.getStateMachine(jobId);
    if (machine) {
      // Unsubscribe from MQTT topics
      this.mqttService.unsubscribe(`job/${jobId}/bin/openFail`);
      this.mqttService.unsubscribe(`job/${jobId}/process-item/error`);
      this.mqttService.unsubscribe(`job/${jobId}/process-item/status`);

      // Remove from state manager
      this.stateManager.removeStateMachine(jobId);
    }
  }

  private async callLockApi(token: string, bin: BinData): Promise<any> {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    return axios({
      method: 'post',
      url: process.env.LOCK_API_URL || 'http://localhost:3000/api/lock/open',
      httpsAgent,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        deviceType: 'CU',
        deviceId: bin.cu_id,
        lockID: [bin.lock_id],
      },
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async handleBinOpenFail(stateMachine: ProcessItemStateMachine, data: any): Promise<void> {
    this.logger.warn(`Bin open failed for job ${stateMachine.getContext().jobId}:`, data);

    // Check if we should retry or skip
    const context = stateMachine.getContext();
    if (context.retryCount < context.maxRetries) {
      stateMachine.transition(ProcessEvent.RETRY, {
        retryCount: context.retryCount + 1,
      });
    } else {
      stateMachine.transition(ProcessEvent.BIN_OPEN_FAIL, {
        currentItemIndex: context.currentItemIndex + 1,
      });
    }
  }

  // Public method for WebSocket to update flags
  updateJobFlag(jobId: string, flag: 'isCloseWarningPopup' | 'isNextRequestItem', value: boolean): boolean {
    const machine = this.stateManager.getStateMachine(jobId);
    if (machine) {
      machine.updateFlag(flag, value);
      return true;
    }
    return false;
  }
}
