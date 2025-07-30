/* eslint-disable */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { sleep } from '@framework/time/sleep';
import { DeviceEntity, PortEntity } from '@entity';
import { PublisherService, Transport } from '@framework/publisher';

@Injectable()
export class MqttService implements OnModuleInit {
  private readonly logger = new Logger(MqttService.name);
  private mqttClient: mqtt.MqttClient;
  private readonly conditionWorkingId = process.env.CONDITION_WORKING_ID || 12;

  constructor(private readonly _publisherService: PublisherService) {}

  async onModuleInit() {
    await this.initMqttConnection();
  }

  private async initMqttConnection() {
    this.mqttClient = mqtt.connect('mqtt://localhost:1883', {
      rejectUnauthorized: false,
      connectTimeout: 5000,
    });

    this.mqttClient.on('connect', async () => {
      this.logger.log('MQTT connected successfully');
      this.mqttClient.subscribe('lock/openSuccess', (err) => {
        if (err) {
          this.logger.error('Failed to subscribe to lock/openSuccess', err);
        } else {
          this.logger.log('Subscribed to lock/openSuccess');
        }
      });
    });

    this.mqttClient.on('message', this.handleMqttMessage.bind(this));
  }

  private async handleMqttMessage(topic: string, message: Buffer) {
    if (topic === 'lock/openSuccess') {
      try {
        this.logger.log(`Processing started at: ${new Date()}`);

        // Publish processing status
        this.publishMessage('process-item/status', { isProcessingItem: true });

        const messageData = JSON.parse(message.toString());
        await this.processLockOpenSuccess(messageData);
      } catch (error) {
        this.logger.error('Error processing message:', error);
      }
    }
  }

  private async processLockOpenSuccess(messageData: any) {
    const currentListDevice = await this.getListDevice({});
    await sleep(1000);

    const currentTime = new Date();
    const { type, data, deviceType, deviceId, lockId, transId } = messageData;
    const { cabinet, bin, requestItems, storageItems } = data;
    const items = [...requestItems, ...storageItems];

    let isNextRequestItem = true;
    const damageItems: any[] = [];

    // Wait for lock to close
    await this.waitForLockClose(deviceType, deviceId, lockId, currentTime);

    this.logger.log(`Processing ended at: ${new Date()}`);

    const [transaction, newListDevice] = await Promise.all([
      this.transactionModel.findOne({ id: transId }).exec(),
      this.getListDevice({ binId: bin.id }),
    ]);

    const logData: { cabinet: any; bin: any; actualItems: any[] } = {
      cabinet,
      bin,
      actualItems: [],
    };

    if (newListDevice.length > 0 && currentListDevice.length > 0) {
      // Process device changes
      const processedData = this.processDeviceChanges(newListDevice, currentListDevice, items, type, isNextRequestItem, damageItems, bin);

      logData.actualItems = processedData.logItems;
      isNextRequestItem = processedData.isNextRequestItem;
    }

    // Update transaction if there are changes
    if (logData.actualItems.length && transaction) {
      await transaction.updateOne({
        locationsTemp: [...transaction.locations, logData],
      });
    }

    // Handle damage items
    if (isNextRequestItem && damageItems.length) {
      await this.processDamageItems(damageItems);
    }

    // Publish error if needed
    if (!isNextRequestItem && transaction) {
      this.publishMessage(`${transaction.type}/error`, {
        data: { ...logData, requestItems },
      });

      this.publishMessage('process-item/error', {
        isCloseWarningPopup: false,
        type: transaction.type,
      });
    }

    // Publish final status
    this.publishMessage('process-item/status', {
      isProcessingItem: false,
      isNextRequestItem,
    });
  }

  private processDeviceChanges(
    newListDevice: any[],
    currentListDevice: any[],
    items: any[],
    type: string,
    isNextRequestItem: boolean,
    damageItems: any[],
    bin: any,
  ) {
    const logItems: any[] = [];
    let nextItemFlag = isNextRequestItem;

    for (const device of newListDevice) {
      const currentDevice = currentListDevice.find((el) => el.id === device.id);
      if (!currentDevice) {
        this.logger.warn('Current device not found');
        continue;
      }

      const item = items.find((item) => item.id === currentDevice.itemId);
      if (!item) continue;

      const changedQty = device.qty - item.preQty;
      const actualQty = Math.abs(changedQty);
      const requestQty = item.requestQty;

      const logItem = {
        id: item.id,
        name: item.name,
        partNo: item.partNo,
        materialNo: item.materialNo,
        itemTypeId: item.itemTypeId,
        type: item.type,
        conditionId: item.conditionId === 0 ? this.conditionWorkingId : item.conditionId,
        quantity: actualQty,
        previousQty: item.preQty,
        currentQty: parseInt(device.qty),
        changedQty,
        listWO: [],
      };

      if (item.listWO) {
        logItem.listWO = item.listWO;
      }

      if (actualQty !== 0) {
        logItems.push(logItem);
      }

      if (actualQty !== requestQty) {
        nextItemFlag = false;
      }

      if (nextItemFlag && type === this.processItemType.RETURN && requestQty !== 0) {
        if (item.conditionId !== 0) {
          damageItems.push({
            deviceId: currentDevice.id,
            binId: bin.id,
            damageQty: changedQty,
          });
        }
      }
    }

    return { logItems, isNextRequestItem: nextItemFlag };
  }

  private async processDamageItems(damageItems: any[]) {
    const deviceIds = damageItems.map((item) => item.deviceId);
    const binIds = [...new Set(damageItems.map((item) => item.binId))];

    // Get all devices and bins in batch
    const [devices, bins] = await Promise.all([
      this.deviceModel.find({ deviceId: { $in: deviceIds } }).exec(),
      this.binModel.find({ id: { $in: binIds } }).exec(),
    ]);

    // Create maps for quick lookup
    const deviceMap = new Map(devices.map((device) => [device.deviceId, device]));
    const binMap = new Map(bins.map((bin) => [bin.id, bin]));

    // Batch updates
    const deviceUpdates = [];
    const binUpdates = [];

    for (const item of damageItems) {
      const device = deviceMap.get(item.deviceId);
      if (device) {
        deviceUpdates.push({
          updateOne: {
            filter: { _id: device._id },
            update: { $inc: { damageQuantity: item.damageQty } },
          },
        });
      }

      const bin = binMap.get(item.binId);
      if (bin) {
        binUpdates.push({
          updateOne: {
            filter: { _id: bin._id },
            update: { $set: { isDamage: 1 } },
          },
        });
      }
    }

    // Execute batch updates
    await Promise.all([
      deviceUpdates.length > 0 ? this.deviceModel.bulkWrite(deviceUpdates) : Promise.resolve(),
      binUpdates.length > 0 ? this.binModel.bulkWrite(binUpdates) : Promise.resolve(),
    ]);
  }

  private async getListDevice(condition: any = {}): Promise<any[]> {
    try {
      // Get all devices with condition
      const devices = (await this.deviceModel.find(condition).sort({ portId: 1, deviceId: 1 }).lean().exec()) as DeviceEntity[];

      if (!devices.length) {
        return [];
      }
      // Get online devices (heartbeat within 30 seconds)
      const onlineDevices = devices.filter((device) => device.isAlive());

      if (!onlineDevices.length) {
        return [];
      }

      // Get all related data in batch
      const portIds = [...new Set(onlineDevices.map((device) => device.portId))];

      const ports = (await this.portModel
        .find({ _id: { $in: portIds } })
        .lean()
        .exec()) as PortEntity[];

      // Create maps for quick lookup
      const portMap = new Map(ports.map((port) => [port.id, port]));

      // Build payload
      return onlineDevices.map((device) => {
        const port = portMap.get(device.portId);
        return {
          hardwarePort: port?.path || '',
          deviceId: device.id,
          deviceNumId: device.deviceNumId,
          name: device.description?.name || '',
          partNumber: device.description?.partNumber || '',
          portId: port?.id || '',
          totalQty: device.calcQuantity,
          qty: device.quantity + device.changeQty,
          status: device.status,
          itemId: device.itemId,
        };
      });
    } catch (error) {
      this.logger.error('Error getting device list:', error);
      return [];
    }
  }

  private publishMessage(topic: string, data: any) {
    return this._publisherService.publish(Transport.MQTT, topic, data);
  }
}
