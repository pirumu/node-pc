import { Injectable, Logger } from '@nestjs/common';
import { createActor, fromPromise } from 'xstate';
import { issueItemTransactionStateMachine } from '../states';

@Injectable()
export class IssueItemProcessor {
  private readonly _logger = new Logger(IssueItemProcessor.name);
  private _actors = new Map<string, any>();

  constructor() {
    // Inject your repositories here
    this.setupMqttListeners();
  }

  public async startTransaction(input: {
    action: string;
    user: {
      id: string;
      loginId: string;
      cloudId: string;
      role: string;
    };
    data: any[];
    requestQty: number;
    tabletDeviceId: string;
  }) {
    const { action, user, data, requestQty, tabletDeviceId } = input;

    const processId = `tx-${Date.now()}-${user.id}`;

    const actor = createActor(
      issueItemTransactionStateMachine.provide({
        actors: {
          createTransaction: fromPromise(async ({ input }) => {
            const tablet = await this.getTablet(input.tabletDeviceId);
            const transaction = await this.createTransactionRecord({
              name: '',
              type: input.type,
              request_qty: input.requestQty,
              cluster_id: tablet?.setting?.clusterId,
              user: {
                id: input.user.user_cloud_id,
                userLogin: input.user.userLogin,
                userRole: input.user.userRole,
              },
              locations: [],
              locations_temp: [],
              status: 'process',
              is_sync: 0,
            });
            return { transactionId: transaction.id };
          }),
          getDeviceList: fromPromise(async ({ input }) => {
            const devices = await this.getDevices();
            const now = new Date().getTime();
            const onlineDevices = devices.filter((d) => parseInt(d.heartbeat) > now - 30000);
            return onlineDevices.map((device) => ({
              hardware_port: device.port?.path,
              id: device.deviceId,
              name: device.deviceDescription?.name || '',
              part_number: device.deviceDescription?.partNumber || '',
              port_id: device.deviceId % 100,
              total_qty: device.calcQuantity,
              qty: parseInt(device.quantity) + device.changeqty,
              status: device.status,
              item_id: device.itemId,
            }));
          }),
          prepareBin: fromPromise(async ({ input }) => {
            const bin = input.bin;
            if (bin.is_failed) {
              return { success: false };
            }

            const device = await this.getDeviceByBinId(bin.id);
            if (device) {
              await this.updateDeviceZeroWeight(device.id, device.weight);
            }
            return { success: true };
          }),
          openLock: fromPromise(async ({ input }) => {
            const bin = input.bin;
            const mqttData = this.createMqttData(input);

            this.publishMqtt('bin/open', mqttData);
            await this.wait(1500);

            const response = await this.callLockAPI('open', {
              deviceType: 'CU',
              deviceId: bin.cu_id,
              lockID: [bin.lock_id],
            });

            if (!response.data?.results?.length) {
              await this.incrementBinFailureCount(bin.id);
              return { success: false };
            }

            await this.updateBinStatus(bin.id, { is_locked: 0, count_failed: 0 });
            return { success: true };
          }),
          waitLockClose: fromPromise(async ({ input }) => {
            const mqttData = this.createMqttData(input);
            const startTime = new Date();

            while (new Date().getTime() - startTime.getTime() < 3600000) {
              await this.wait(1000);
              const status = await this.callLockAPI('status', {
                deviceType: 'CU',
                deviceId: mqttData.deviceId,
                lockID: [mqttData.lockId],
              });

              if (status?.results?.every((r) => r.status !== 'Open')) {
                break;
              }
            }

            await this.wait(2000);
            return { closed: true };
          }),
          processTransaction: fromPromise(async ({ input }) => {
            this.publishMqtt('process-item/status', { isProcessingItem: true });

            const currentItem = input.data[input.currentIndex];
            const items = [...currentItem.request_items, ...currentItem.storage_items];
            const newDeviceList = await this.getDevicesByBinId(currentItem.bin.id);

            let isNextRequestItem = true;
            const damageItems = [];
            const logData = { cabinet: currentItem.cabinet, bin: currentItem.bin, spares: [] };

            for (const device of newDeviceList) {
              const currentDevice = input.deviceList.find((d) => d.id === device.id);
              if (!currentDevice) {
                continue;
              }

              const item = items.find((i) => i.id === currentDevice.item_id);
              if (!item) {
                continue;
              }

              const changedQty = device.qty - item.pre_qty;
              const actualQty = Math.abs(changedQty);

              if (actualQty !== item.request_qty) {
                isNextRequestItem = false;
              }

              if (actualQty !== 0) {
                logData.spares.push({
                  id: item.id,
                  name: item.name,
                  part_no: item.part_no,
                  material_no: item.material_no,
                  item_type_id: item.item_type_id,
                  type: item.type,
                  condition_id: item.condition_id === 0 ? 12 : item.condition_id,
                  quantity: actualQty,
                  previous_qty: item.pre_qty,
                  current_qty: parseInt(device.qty),
                  changed_qty: changedQty,
                  ...(item.listWO && { listWO: item.listWO }),
                });
              }

              if (isNextRequestItem && input.type === 'return' && item.request_qty !== 0 && item.condition_id !== 0) {
                damageItems.push({ deviceId: currentDevice.id, binId: currentItem.bin.id, damageQty: changedQty });
              }
            }

            if (logData.spares.length) {
              await this.updateTransactionLocations(input.transactionId, logData);
            }

            if (isNextRequestItem && damageItems.length) {
              await this.processDamageItems(damageItems);
            }

            if (!isNextRequestItem) {
              this.publishMqtt(`${input.type}/error`, { data: { ...logData, request_items: currentItem.request_items } });
              this.publishMqtt('process-item/error', { isCloseWarningPopup: false, type: input.type });
            }

            this.publishMqtt('process-item/status', { isProcessingItem: false, isNextRequestItem });
            return { logData, isNextRequestItem, damageItems };
          }),
          processReturnItems: fromPromise(async ({ input }) => {
            const transaction = await this.getTransaction(input.transactionId);
            await this.updateTransactionStatus(input.transactionId, {
              locations: transaction.locations_temp,
              locations_temp: [],
            });

            const currentItem = input.data[input.currentIndex];
            const bin = currentItem.bin;

            if (input.type === 'issue') {
              await this.processIssueReturnItems(transaction, input.user, bin);
            } else if (input.type === 'return') {
              await this.processReturnReturnItems(transaction, input.user, bin);
            }

            return { success: true };
          }),
          finalizeTransaction: fromPromise(async ({ input }) => {
            await this.updateTransactionStatus(input.transactionId, {
              name: `trans#${input.transactionId}`,
              status: 'done',
            });
            return { success: true };
          }),
        },
      }),
    );

    this._actors.set(processId, actor);
    actor.start();
    actor.send({ type: 'START', token, type, user, data, requestQty, uniqueId });

    return { processId };
  }

  private setupMqttListeners() {
    this.onMqttMessage('lock/openSuccess', (message) => {
      this.findActorByTransactionId(message.transId)?.send({ type: 'LOCK_OPEN_SUCCESS', message });
    });

    this.onMqttMessage('lock/openFail', (message) => {
      this.findActorByMessage(message)?.send({ type: 'LOCK_OPEN_FAIL', message });
    });

    this.onMqttMessage('bin/openFail', (message) => {
      this.findActorByBinId(message.binId)?.send({ type: 'BIN_OPEN_FAIL', message });
    });

    this.onMqttMessage('process-item/status', (message) => {
      this._actors.forEach((actor) => actor.send({ type: 'PROCESS_ITEM_STATUS', message }));
    });

    this.onMqttMessage('process-item/error', (message) => {
      this._actors.forEach((actor) => actor.send({ type: 'PROCESS_ITEM_ERROR', message }));
    });
  }

  private createMqttData(input: any) {
    return {
      deviceType: 'CU',
      deviceId: input.bin.cu_id,
      lockId: input.bin.lock_id,
      user: input.user,
      type: input.type,
      data: input,
      transId: input.transactionId,
      is_final: input.is_final,
    };
  }

  private findActorByTransactionId(transId: number) {
    for (const actor of this._actors.values()) {
      if (actor.getSnapshot().context.transactionId === transId) {
        return actor;
      }
    }
    return null;
  }

  private findActorByBinId(binId: number) {
    for (const actor of this._actors.values()) {
      const context = actor.getSnapshot().context;
      if (context.data[context.currentIndex]?.bin?.id === binId) {
        return actor;
      }
    }
    return null;
  }

  private findActorByMessage(message: any) {
    // Implement logic to find actor by message
    return null;
  }

  // Implement these methods with your actual repositories/services
  private async getTablet(uniqueId: string) {
    /* */
  }
  private async createTransactionRecord(data: any) {
    /* */
  }
  private async getDevices() {
    /* */
  }
  private async getDeviceByBinId(binId: number) {
    /* */
  }
  private async updateDeviceZeroWeight(deviceId: number, weight: number) {
    /* */
  }
  private async callLockAPI(action: string, data: any) {
    /* */
  }
  private async incrementBinFailureCount(binId: number) {
    /* */
  }
  private async updateBinStatus(binId: number, status: any) {
    /* */
  }
  private async getDevicesByBinId(binId: number) {
    /* */
  }
  private async updateTransactionLocations(transId: number, logData: any) {
    /* */
  }
  private async processDamageItems(items: any[]) {
    /* */
  }
  private async getTransaction(transId: number) {
    /* */
  }
  private async updateTransactionStatus(transId: number, status: any) {
    /* */
  }
  private async processIssueReturnItems(transaction: any, user: any, bin: any) {
    /* */
  }
  private async processReturnReturnItems(transaction: any, user: any, bin: any) {
    /* */
  }
  private publishMqtt(topic: string, message: any) {
    /* */
  }
  private onMqttMessage(topic: string, handler: (message: any) => void) {
    /* */
  }
  private async wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
