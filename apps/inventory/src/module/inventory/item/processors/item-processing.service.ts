import { PROCESS_ITEM_TYPE } from '@common/constants';
import { CuLockRequest } from '@culock/dto';
import { Command, LOCK_STATUS, ProtocolType } from '@culock/protocols';
import { CuResponse } from '@culock/protocols/cu';
import { TransactionEntity } from '@entity';
import { PublisherService, Transport } from '@framework/publisher';
import { sleep } from '@framework/time/sleep';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ProcessItemRequest } from '../item.types';
import { IItemRepository, IProcessItemRepository, ITEM_REPOSITORY_TOKEN, PROCESS_ITEM_REPOSITORY_TOKEN } from '../repositories';

import { TransactionContext } from './item-processing.types';

// Constants
const PROCESS_CONFIG = {
  MAX_FAILED_ATTEMPTS: 3,
  WAIT_TIMES: {
    BIN_OPEN: 1500,
    LOCK_PROCESSING: 2000,
    POLLING_INTERVAL: 1000,
  },
  TIMEOUTS: {
    MANUAL_INTERVENTION: 60000,
    NEXT_REQUEST: 30000,
  },
};

const MQTT_TOPICS = {
  BIN_OPEN: 'bin/open',
  BIN_CLOSE: 'bin/close',
  CU_OPEN: 'cu/open',
  LOCK_OPEN_SUCCESS: 'lock/openSuccess',
  LOCK_OPEN_FAIL: 'lock/openFail',
};

// Types

type BinOpenResult = {
  success: boolean;
  shouldSkip: boolean;
  error?: string;
};

@Injectable()
export class ItemProcessingService {
  private readonly _logger = new Logger(ItemProcessingService.name);
  private _transactionContextMap = new Map<string, TransactionContext>();

  constructor(
    @Inject(ITEM_REPOSITORY_TOKEN) private readonly _itemRepository: IItemRepository,
    @Inject(PROCESS_ITEM_REPOSITORY_TOKEN) private readonly _repository: IProcessItemRepository,
    private readonly _publisherService: PublisherService,
  ) {}

  // ==================== Context Management =======================//

  private _initContext(transactionId: string, input: ProcessItemRequest, transaction: TransactionEntity) {
    if (this._transactionContextMap.has(transactionId)) {
      throw new Error(`Context already exists for transaction: ${transactionId}`);
    }

    this._transactionContextMap.set(transactionId, {
      currentItemIndex: 0,
      totalItem: input.data.length,
      items: input.data,
      user: input.user,
      transactionType: input.transactionType,
      transaction,
      state: {
        isCloseWarningPopup: false,
        isProcessingItem: true,
        isNextRequestItem: false,
      },
    });

    this._logger.log(`Context initialized for transaction ${transactionId}`);
  }

  private _getContext(transactionId: string): TransactionContext {
    const ctx = this._transactionContextMap.get(transactionId);
    if (!ctx) {
      throw new Error(`Transaction context not found: ${transactionId}`);
    }
    return ctx;
  }

  private _increaseItemIndex(transactionId: string, increment = 1): number {
    const ctx = this._getContext(transactionId);
    ctx.currentItemIndex += increment;
    return ctx.currentItemIndex;
  }

  private _cleanUp(transactionId: string) {
    this._transactionContextMap.delete(transactionId);
    this._logger.log(`Context cleaned up for transaction ${transactionId}`);
  }

  // ==================== Public API =======================//

  public async createTransaction(input: ProcessItemRequest): Promise<TransactionEntity> {
    try {
      const transaction = new TransactionEntity({
        id: '',
        name: `tx-${new Date().toISOString()}`,
        type: input.transactionType,
        requestQty: input.requestQty,
        clusterId: input.clusterId,
        user: input.user,
        locations: [],
        locationsTemp: [],
        status: 'process',
        isSync: false,
        retryCount: 0,
        error: null,
      });

      const entity = await this._repository.createTransaction(transaction);
      this._logger.log(`Transaction created: ${entity.id}`);

      return transaction;
    } catch (error) {
      this._logger.error(`Failed to create transaction:`, error);
      throw error;
    }
  }

  public async start(input: ProcessItemRequest): Promise<void> {
    let transactionId: string | null = null;

    try {
      // Create transaction and context
      const tx = await this.createTransaction(input);
      transactionId = tx.id;
      this._initContext(tx.id, input, tx);
      const ctx = this._getContext(transactionId);

      this._logger.log(`Starting processing for transaction ${transactionId} with ${ctx.totalItem} items`);

      // Process each item
      while (ctx.currentItemIndex < ctx.totalItem) {
        const item = ctx.items[ctx.currentItemIndex];

        try {
          await this._processItem(transactionId, item);
          this._increaseItemIndex(transactionId);
        } catch (error) {
          this._logger.error(`Failed to process item ${ctx.currentItemIndex} in transaction ${transactionId}:`, error);

          // Continue with next item instead of failing entire transaction
          this._increaseItemIndex(transactionId);
        }
      }

      // Complete transaction
      await this._completeTransaction(transactionId);
    } catch (error) {
      this._logger.error(`Transaction processing failed:`, error);

      if (transactionId) {
        await this._failTransaction(transactionId, error.message);
      }

      throw error;
    } finally {
      if (transactionId) {
        this._cleanUp(transactionId);
      }
    }
  }

  // ==================== MQTT Event Handlers =======================//

  public async handleBinOpenFail(transactionId: string, binId: string): Promise<void> {
    try {
      const ctx = this._getContext(transactionId);
      const bin = await this._repository.findBinById(binId);

      if (!bin) {
        this._logger.warn(`Bin not found for failure notification: ${binId}`);
        return;
      }

      if (!bin.isFailed) {
        const item = ctx.items.find((item) => item.bin.id === binId);
        if (item) {
          this._logger.log(`Publishing lock open fail for bin ${binId}`, item);
          await this._publisherService.publish(Transport.MQTT, MQTT_TOPICS.LOCK_OPEN_FAIL, item);
        }
      }
    } catch (error) {
      this._logger.error(`Failed to handle bin open fail:`, error);
    }
  }

  public updateProcessStatus(
    transactionId: string,
    newState: {
      isProcessingItem: boolean;
      isNextRequestItem: boolean;
    },
  ): void {
    try {
      const ctx = this._getContext(transactionId);
      ctx.state.isProcessingItem = newState.isProcessingItem;
      ctx.state.isNextRequestItem = newState.isNextRequestItem;

      this._logger.debug(`Process status updated for ${transactionId}:`, newState);
    } catch (error) {
      this._logger.error(`Failed to update process status:`, error);
    }
  }

  public updateProcessError(
    transactionId: string,
    newState: {
      isCloseWarningPopup: boolean;
      isNextRequestItem: boolean;
    },
  ): void {
    try {
      const ctx = this._getContext(transactionId);
      ctx.state.isCloseWarningPopup = newState.isCloseWarningPopup;
      ctx.state.isNextRequestItem = newState.isNextRequestItem;

      this._logger.debug(`Process error state updated for ${transactionId}:`, newState);
    } catch (error) {
      this._logger.error(`Failed to update process error state:`, error);
    }
  }

  // ==================== Private Processing Methods =======================//

  private async _processItem(transactionId: string, item: ProcessItemRequest['data'][number]): Promise<void> {
    const ctx = this._getContext(transactionId);
    const isFinalItem = ctx.currentItemIndex === ctx.totalItem - 1;

    this._logger.log(`Processing item ${ctx.currentItemIndex + 1}/${ctx.totalItem} for bin ${item.bin.id}`);

    // 1. Check bin status
    const shouldSkip = await this._checkBinStatus(item.bin.id);
    if (shouldSkip) {
      this._logger.warn(`Skipping failed bin ${item.bin.id}`);
      return;
    }

    // 2. Prepare a device
    await this._updateDeviceZeroWeight(item.bin.id);

    // 3. Trigger loadcells calculation
    await this._triggerLoadcells(transactionId, item);
    await sleep(PROCESS_CONFIG.WAIT_TIMES.BIN_OPEN);

    // 4. Open bin lock
    const openResult = await this._openBinWithRetry(transactionId, item);
    if (openResult.shouldSkip) {
      this._logger.warn(`Skipping bin ${item.bin.id}: ${openResult.error}`);
      return;
    }

    // 5. Process bin operations
    await this._processBinOperations(transactionId, item, isFinalItem);

    // 6. Handle transaction updates
    await this._handleTransactionUpdates(transactionId, item.bin.id);
  }

  private async _checkBinStatus(binId: string): Promise<boolean> {
    const bin = await this._repository.findBinById(binId);
    if (!bin) {
      throw new Error(`Bin not found: ${binId}`);
    }
    return bin.isFailed;
  }

  private async _updateDeviceZeroWeight(binId: string): Promise<void> {
    const isUpdated = await this._repository.updateDeviceZeroWeightByBinId(binId);
    if (!isUpdated) {
      throw new Error(`Failed to update device zero weight for bin ${binId}`);
    }
  }

  private async _triggerLoadcells(transactionId: string, item: ProcessItemRequest['data'][number]): Promise<void> {
    await this._publisherService.publish(Transport.MQTT, MQTT_TOPICS.BIN_OPEN, {
      transactionId: transactionId,
      binId: item.bin.id,
    });
  }

  private async _openBinWithRetry(transactionId: string, item: ProcessItemRequest['data'][number]): Promise<BinOpenResult> {
    const MAX_RETRIES = 3; // Only try once more after initial failure

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const result = await this._openBin(item);

      if (result.success) {
        await this._repository.updateBinOpenStatus({
          id: item.bin.id,
          isLocked: false,
          countFailed: 0,
        });

        return { success: true, shouldSkip: false };
      }

      // Handle failure
      const shouldSkip = await this._handleBinOpenFailure(transactionId, item.bin.id, item);

      if (shouldSkip) {
        return {
          success: false,
          shouldSkip: true,
          error: 'Bin marked as failed or max attempts reached',
        };
      }

      if (attempt < MAX_RETRIES) {
        await sleep(2000);
        this._logger.log(`Retrying bin open for ${item.bin.id}, attempt ${attempt + 2}`);
      }
    }

    return {
      success: false,
      shouldSkip: true,
      error: 'Max retry attempts reached',
    };
  }

  private async _openBin(item: ProcessItemRequest['data'][number]): Promise<{ success: boolean }> {
    try {
      const request = new CuLockRequest({
        protocol: ProtocolType.CU,
        deviceId: item.bin.cuId,
        lockIds: [item.bin.lockId],
        command: Command.OPEN_LOCK,
      });

      const response = await this._publisherService.publish<CuResponse>(Transport.MQTT, MQTT_TOPICS.CU_OPEN, request, {}, { async: false });
      console.log('response', response);
      this._logger.log(`Lock API response for bin ${item.bin.id}:`, response);

      return {
        success: response?.isSuccess && Object.values(response.lockStatuses || {}).every((l) => l === LOCK_STATUS.OPEN),
      };
    } catch (error) {
      this._logger.error(`Failed to open bin ${item.bin.id}:`, error);
      return { success: false };
    }
  }

  private async _handleBinOpenFailure(transactionId: string, binId: string, item: ProcessItemRequest['data'][number]): Promise<boolean> {
    try {
      const bin = await this._repository.findBinById(binId);
      if (!bin) {
        throw new Error(`Bin not found: ${binId}`);
      }
      const newFailCount = (bin.countFailed || 0) + 1;
      await this._repository.updateBinOpenStatus({
        id: binId,
        countFailed: newFailCount,
      });

      this._logger.warn(`Lock failed for bin ${binId}, failure count: ${bin.countFailed || 0} -> ${newFailCount}`);

      await this._publisherService.publish(Transport.MQTT, MQTT_TOPICS.LOCK_OPEN_FAIL, item);

      if (bin.isFailed || newFailCount >= PROCESS_CONFIG.MAX_FAILED_ATTEMPTS) {
        this._logger.warn(`Skipping bin ${binId} - max failures reached or marked as failed`);
        return true;
      }

      // Wait for manual intervention
      this._logger.log(`Waiting for manual intervention for bin ${binId}...`);

      const isRecovered = await this._waitForCondition(
        async () => {
          const updatedBin = await this._repository.findBinById(binId);
          if (!updatedBin) {
            return false;
          }

          if (!updatedBin.isLocked) {
            this._logger.log(`Bin ${binId} manually unlocked`);
            return true;
          }

          if (updatedBin.isFailed || updatedBin.countFailed >= PROCESS_CONFIG.MAX_FAILED_ATTEMPTS) {
            this._logger.log(`Bin ${binId} marked as failed during wait`);
            return true;
          }

          return false;
        },
        PROCESS_CONFIG.TIMEOUTS.MANUAL_INTERVENTION,
        PROCESS_CONFIG.WAIT_TIMES.POLLING_INTERVAL,
      );

      if (!isRecovered) {
        this._logger.warn(`Timeout waiting for manual intervention for bin ${binId}`);
        await this._repository.updateBinOpenStatus({
          id: binId,
          isFailed: true,
        });
        return true;
      }

      // Final check
      const finalBin = await this._repository.findBinById(binId);
      return finalBin?.isFailed || (finalBin?.countFailed || 0) >= PROCESS_CONFIG.MAX_FAILED_ATTEMPTS;
    } catch (error) {
      this._logger.error(`Error handling bin open failure for ${binId}:`, error);
      // Mark as failed on error
      await this._repository.updateBinOpenStatus({
        id: binId,
        isFailed: true,
      });
      return true;
    }
  }

  private async _processBinOperations(
    transactionId: string,
    item: ProcessItemRequest['data'][number],
    isFinalItem: boolean,
  ): Promise<void> {
    const ctx = this._getContext(transactionId);

    // Publish lock open success
    // todo: refactor it.
    const mqttData = {
      deviceType: 'culock',
      deviceId: item.bin.cuId,
      lockId: item.bin.lockId,
      user: ctx.user,
      type: ctx.transactionType,
      data: item,
      transId: ctx.transaction?.id,
      is_final: isFinalItem,
    };

    await this._publisherService.publish(Transport.MQTT, MQTT_TOPICS.LOCK_OPEN_SUCCESS, mqttData);

    // Wait for item processing
    await sleep(PROCESS_CONFIG.WAIT_TIMES.LOCK_PROCESSING);

    await this._waitForCondition(() => !ctx.state.isProcessingItem, 30000, 1000);

    // Lock the bin
    await this._repository.updateBinOpenStatus({
      id: item.bin.id,
      isLocked: true,
    });

    // Close bin
    await this._publisherService.publish(Transport.MQTT, MQTT_TOPICS.BIN_CLOSE, mqttData);

    // Wait for close confirmation
    await this._waitForCondition(() => ctx.state.isCloseWarningPopup, 30000, 1000);

    // Wait for next request confirmation
    await this._waitForCondition(() => ctx.state.isNextRequestItem, PROCESS_CONFIG.TIMEOUTS.NEXT_REQUEST, 1000);
  }

  private async _handleTransactionUpdates(transactionId: string, binId: string): Promise<void> {
    const ctx = this._getContext(transactionId);

    if (!ctx.transaction) {
      throw new Error(`Transaction entity not found in context: ${transactionId}`);
    }

    // Update transaction locations
    const updatedTransaction = await this._repository.findTransactionById(transactionId);
    if (updatedTransaction) {
      await this._repository.updateTransaction(transactionId, {
        locations: updatedTransaction.locationsTemp,
        locationsTemp: [],
      });

      // Handle return items based on transaction type
      await this._handleItems(transactionId, binId, updatedTransaction);
    }
  }

  private async _handleItems(transactionId: string, binId: string, transaction: TransactionEntity): Promise<void> {
    const ctx = this._getContext(transactionId);

    if (transaction.type === PROCESS_ITEM_TYPE.ISSUE) {
      await this._handleIssueItems(transaction, binId, ctx.user.id);
    } else if (transaction.type === PROCESS_ITEM_TYPE.RETURN) {
      await this._handleReturnItems(transaction, binId, ctx.user.id);
    }
  }

  private async _handleIssueItems(transaction: TransactionEntity, binId: string, userId: string): Promise<void> {
    // This would be similar to the return item logic from the original code
    // Implementation depends on your return item repository interface
    this._logger.log(`Handling issue return items for transaction ${transaction.id}, bin ${binId}`);
    // TODO: Implement based on your IItemRepository interface
  }

  private async _handleReturnItems(transaction: TransactionEntity, binId: string, userId: string): Promise<void> {
    // This would be similar to the return item logic from the original code
    this._logger.log(`Handling return return items for transaction ${transaction.id}, bin ${binId}`);
    // TODO: Implement based on your IItemRepository interface
  }

  private async _completeTransaction(transactionId: string): Promise<void> {
    await this._repository.updateTransaction(transactionId, {
      name: `trans#${transactionId}`,
      status: 'done',
    });

    this._logger.log(`Transaction ${transactionId} completed successfully`);
  }

  private async _failTransaction(transactionId: string, errorMessage: string): Promise<void> {
    try {
      await this._repository.updateTransaction(transactionId, {
        status: 'failed',
        error: errorMessage,
      });

      this._logger.error(`Transaction ${transactionId} marked as failed: ${errorMessage}`);
    } catch (error) {
      this._logger.error(`Failed to update transaction status to failed:`, error);
    }
  }

  // ==================== Utility Methods =======================//

  private async _waitForCondition(
    conditionFn: () => boolean | Promise<boolean>,
    maxWaitTime = 30000,
    pollInterval = 1000,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const isTrue = await conditionFn();
        if (isTrue) {
          return true;
        }
      } catch (error) {
        this._logger.warn('Condition check failed:', error);
      }

      await sleep(pollInterval);
    }

    return false; // Timeout
  }
}
