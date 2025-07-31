import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { PROCESS_ITEM_TYPE, ProcessEvent, ProcessState } from '../item.constants';

import { ProcessItemStateMachine } from './process-item.state-machine';
import { BinData, ItemData, ItemSpare, LocationData, MqttMessage, ProcessItemJobData, User } from './type';
import { MqttClient } from 'mqtt';
import { BinEntity, DeviceEntity } from '@entity';
import { sleep } from '@framework/time/sleep';

@Injectable()
export class ProcessItemService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(ProcessItemService.name);
  private _mqttClients = new Map<string, MqttClient>();
  private _stateMachines = new Map<string, ProcessItemStateMachine>();

  constructor(@InjectQueue('process-item') private _processQueue: Queue) {}

  public onModuleInit(): void {}

  public onModuleDestroy(): void {
    for (const [jobId, client] of this._mqttClients) {
      client.end();
    }
  }

  public async createProcessJob(data: ProcessItemJobData): Promise<Job> {
    return this._processQueue.add('xxx', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  public async processItems(jobId: string, data: ProcessItemJobData): Promise<void> {
    const { action, user, data: items, requestQty, tabletId } = data;
    const deviceType = 'CU';
    const processName = `serial-user/${action}/${user.id}`;

    // Initialize state machine
    const stateMachine = new ProcessItemStateMachine(items.length);
    this._stateMachines.set(jobId, stateMachine);

    // Start state machine
    stateMachine.transition(ProcessEvent.START);

    try {
      // Connect MQTT
      const mqttClient = await this.connectMqtt(jobId, stateMachine);
      this._mqttClients.set(jobId, mqttClient);

      stateMachine.transition(ProcessEvent.MQTT_CONNECTED);

      // Create transaction
      const tablet = await Tablet.findOne({ where: { uniqueId } });
      const transaction = await Transaction.create({
        name: '',
        type: type,
        request_qty: parseInt(request_qty.toString()),
        cluster_id: tablet.setting.clusterId,
        user: {
          id: user.user_cloud_id,
          userLogin: user.userLogin,
          userRole: user.userRole,
        },
        locations: [],
        locations_temp: [],
        status: 'process',
        is_sync: 0,
      });

      stateMachine.transition(ProcessEvent.MQTT_CONNECTED, { transactionId: transaction.id });

      // Process each item
      while (stateMachine.getContext().currentItemIndex < items.length) {
        const context = stateMachine.getContext();
        const item = items[context.currentItemIndex];

        this._logger.log(`Processing item ${context.currentItemIndex + 1}/${items.length}`);

        // Check if we should process this item
        if (stateMachine.getState() === ProcessState.READY || stateMachine.getState() === ProcessState.PROCESSING_NEXT) {
          stateMachine.transition(ProcessEvent.PROCESS_ITEM, {
            currentItem: item,
            currentBin: item.bin,
          });

          await this.processItem(
            stateMachine,
            mqttClient,
            deviceType,
            user,
            item,
            transaction.id,
            context.currentItemIndex === items.length - 1,
          );
        }

        // Wait for state machine to be ready for next item
        await this.waitForState(stateMachine, [ProcessState.PROCESSING_NEXT, ProcessState.READY, ProcessState.COMPLETED]);

        if (stateMachine.getState() === ProcessState.COMPLETED) {
          break;
        }
      }

      // Update transaction status
      await transaction.update({
        name: 'trans#' + transaction.id,
        status: 'done',
      });

      // Cleanup process
      await this._deleteProcess(processName, mqttClient);
    } catch (error) {
      this._logger.error('Error processing items:', error);
      stateMachine.transition(ProcessEvent.ERROR_OCCURRED, { error });
      throw error;
    } finally {
      // Cleanup
      this._stateMachines.delete(jobId);
      const client = this._mqttClients.get(jobId);
      if (client) {
        client.end();
        this._mqttClients.delete(jobId);
      }
    }
  }

  private async connectMqtt(jobId: string, stateMachine: ProcessItemStateMachine): Promise<MqttClient> {
    const opts = {
      rejectUnauthorized: false,
      connectTimeout: 5000,
    };

    return new Promise((resolve, reject) => {
      const mqttClient = mqtt.connect('mqtt://localhost:1883', opts);

      mqttClient.on('connect', () => {
        console.log('connect mqtt done');

        // Subscribe to topics
        const topics = ['lock/openSuccess', 'lock/openFail', 'bin/openFail', 'process-item/error', 'process-item/status'];

        topics.forEach((topic) => {
          mqttClient.subscribe(topic, (err) => {
            if (!err) {
              console.log(`subscribe ${topic} done!`);
            }
          });
        });

        resolve(mqttClient);
      });

      mqttClient.on('error', (error) => {
        reject(error);
      });

      // Setup message handlers
      mqttClient.on('message', async (topic: string, message: any) => {
        switch (topic) {
          case 'bin/openFail':
            await this._handleBinOpenFail(JSON.parse(message.toString()), mqttClient);
            break;

          case 'process-item/error':
            const errorData = JSON.parse(message.toString());
            stateMachine.updateFromMqttError(errorData);
            break;

          case 'process-item/status':
            const statusData = JSON.parse(message.toString());
            stateMachine.updateFromMqttStatus(statusData);
            break;
        }
      });
    });
  }

  private async processItem(
    stateMachine: ProcessItemStateMachine,
    mqttClient: MqttClient,
    token: string,
    deviceType: string,
    user: User,
    item: ItemData,
    transactionId: number,
    isFinal: boolean,
  ): Promise<void> {
    const bin = new BinEntity({} as any); //await Bin.findOne({ where: { id: item.bin.id } });

    if (bin.isFailed) {
      stateMachine.transition(ProcessEvent.SKIP_ITEM, {
        currentItemIndex: stateMachine.getContext().currentItemIndex + 1,
      });
      return;
    }
    // Update device zero weight
    const device = new DeviceEntity({} as any); //await Device.findOne({ where: { binId: bin.id } });
    // await device.update({ zeroWeight: device.weight });

    const mqttData: MqttMessage = {
      protocol: deviceType,
      deviceId: bin.cuId,
      lockId: bin.lockId,
      user,
      type: stateMachine.getContext().currentItem!.bin.id === item.bin.id ? 'issue' : 'return',
      data: item,
      transactionId,
      isFinal: isFinal,
    };

    this._logger.log('mqttData processItemByRequest', mqttData);

    // Trigger loadcells calculate
    mqttClient.publish('bin/open', JSON.stringify(mqttData));
    await this.wait(1500);

    // Open lock
    const isLockOpened = await this.openLock(token, deviceType, bin);

    if (!isLockOpened) {
      await this.handleLockOpenFailure(stateMachine, mqttClient, bin, item);
      return;
    }

    // Lock opened successfully
    bin.isLocked = false;
    bin.countFailed = 0;
    // await bin.save();

    mqttClient.publish('lock/openSuccess', JSON.stringify(mqttData));
    stateMachine.transition(ProcessEvent.LOCK_OPEN_SUCCESS);

    // Wait for user action
    await this._waitForUserAction(stateMachine);

    // Update status lock
    bin.isLocked = true;
    // await bin.save();

    // Close bin
    mqttClient.publish('bin/close', JSON.stringify(mqttData));

    stateMachine.transition(ProcessEvent.BIN_CLOSED);

    // Wait for warning popup to close
    await this.waitForWarningPopup(stateMachine);

    // Update transaction and process return items
    if (stateMachine.getContext().isNextRequestItem) {
      await this.updateTransactionAndReturnItems(
        transactionId,
        user,
        bin,
        item,
        stateMachine.getContext().currentItem!.bin.id === item.bin.id ? 'issue' : 'return',
      );

      stateMachine.transition(ProcessEvent.TRANSACTION_UPDATED, {
        currentItemIndex: stateMachine.getContext().currentItemIndex + 1,
      });
    }
  }

  private async openLock(token: string, deviceType: string, bin: BinData): Promise<boolean> {}

  private async handleLockOpenFailure(
    stateMachine: ProcessItemStateMachine,
    mqttClient: MqttClient,
    bin: BinData,
    item: ItemData,
  ): Promise<void> {
    bin.countFailed = (bin.countFailed || 0) + 1;
    await bin.save();

    let isSkip = false;
    if (bin.isFailed || bin.countFailed >= 3) {
      isSkip = true;
    } else {
      // Send mqtt openLockFail
      mqttClient.publish('lock/openFail', JSON.stringify(item));
    }

    while (!isSkip) {
      const updatedBin = await Bin.findOne({ where: { id: item.bin.id } });
      if (updatedBin.is_locked === 0) {
        break;
      }
      if (updatedBin.is_failed || updatedBin.count_failed >= 3) {
        isSkip = true;
      }
      await sleep(1000);
    }
    if (isSkip) {
      stateMachine.transition(ProcessEvent.SKIP_ITEM, {
        currentItemIndex: stateMachine.getContext().currentItemIndex + 1,
      });
    } else {
      stateMachine.transition(ProcessEvent.LOCK_OPEN_SUCCESS);
    }
  }

  private async _handleBinOpenFail(dataBin: { binId: number }, mqttClient: MqttClient): Promise<void> {
    const bin = await Bin.findOne({ where: { id: dataBin.binId } });
    if (!bin.is_failed) {
      // Find item in current context - would need to pass this through
      // For now, just log
      console.log('Bin open failed:', dataBin.binId);
    }
  }

  private async _waitForUserAction(stateMachine: ProcessItemStateMachine): Promise<void> {
    this._logger.log(`isProcessingItem=${stateMachine.getContext().isProcessingItem}. Wait for next action from user.....`);
    while (stateMachine.getContext().isProcessingItem) {
      await sleep(1000);
    }
  }

  private async waitForWarningPopup(stateMachine: ProcessItemStateMachine): Promise<void> {
    console.log('isCloseWarningPopup', stateMachine.getContext().isCloseWarningPopup);
    while (!stateMachine.getContext().isCloseWarningPopup) {
      await this.wait(1000);
    }
  }

  private async waitForState(stateMachine: ProcessItemStateMachine, targetStates: ProcessState[]): Promise<void> {
    while (!targetStates.includes(stateMachine.getState())) {
      await this.wait(100);
    }
  }

  private async updateTransactionAndReturnItems(
    transactionId: number,
    user: User,
    bin: BinData,
    item: ItemData,
    type: 'issue' | 'return',
  ): Promise<void> {
    // Update transaction
    const transaction = await Transaction.findOne({ where: { id: transactionId } });
    await transaction.update({
      locations: transaction.locations_temp,
      locations_temp: [],
    });

    // Check to upsert returnItems
    if (type === PROCESS_ITEM_TYPE.ISSUE) {
      const itemTypeReplenish = (await ItemType.findAll({ where: { is_return: 0 } })).map((item: any) => item.type);

      // Item consumable isn't written in return_items table
      for (const location of transaction.locations) {
        if (location.bin.id === bin.id) {
          for (const spare of location.spares) {
            const actualQty = Math.abs(spare.changed_qty);
            if (!itemTypeReplenish.includes(spare.type) && actualQty !== 0) {
              await this._upsertReturnItem(user, bin, location, spare, actualQty);
            }
          }
        }
      }
    } else if (type === PROCESS_ITEM_TYPE.RETURN) {
      for (const location of transaction.locations) {
        if (location.bin.id === bin.id) {
          for (const spare of location.spares) {
            const actualQty = Math.abs(spare.changed_qty);
            const getReturnItemByUser = await ReturnItem.findOne({
              where: {
                userId: user.id,
                itemId: spare.id,
              },
            });

            if (getReturnItemByUser) {
              getReturnItemByUser.locations = getReturnItemByUser.locations.map((item: any) => {
                if (item.bin.id === bin.id) {
                  item.quantity -= actualQty;
                }
                return item;
              });
              getReturnItemByUser.quantity -= actualQty;
              await getReturnItemByUser.save();

              if (getReturnItemByUser.quantity <= 0) {
                await getReturnItemByUser.destroy();
              }
            }
          }
        }
      }
    }
  }

  private async _upsertReturnItem(user: User, bin: BinData, location: LocationData, item: ItemSpare, actualQty: number): Promise<void> {
    const getReturnItemByUser = await ReturnItem.findOne({
      where: {
        userId: user.id,
        itemId: item.id,
        binId: bin.id,
      },
    });

    console.log('getReturnItemByUser', JSON.stringify(getReturnItemByUser));

    if (getReturnItemByUser) {
      let locations = [];
      const checkExistLocation = getReturnItemByUser.locations.find((loc: any) => {
        return loc.bin.id === bin.id;
      });

      console.log('checkExistLocation', checkExistLocation, bin.id);

      if (checkExistLocation) {
        locations = getReturnItemByUser.locations.map((loc: any) => {
          if (loc.bin.id === bin.id) {
            loc.quantity += actualQty;
          }
          return loc;
        });
      } else {
        locations = [
          ...getReturnItemByUser.locations,
          {
            cabinet: {
              id: location.cabinet.id,
              name: location.cabinet.name,
            },
            bin: {
              id: location.bin.id,
              name: location.bin.name,
              row: location.bin.row,
            },
            quantity: actualQty,
          },
        ];
      }

      if (getReturnItemByUser.listWo && item.listWO) {
        const listWo = [...getReturnItemByUser.listWo, ...item.listWO];
        getReturnItemByUser.listWo = await this._formatListWo(listWo);
      }

      getReturnItemByUser.locations = locations;
      getReturnItemByUser.quantity += actualQty;
      await getReturnItemByUser.save();
    } else {
      const locations = [
        {
          cabinet: {
            id: location.cabinet.id,
            name: location.cabinet.name,
          },
          bin: {
            id: location.bin.id,
            name: location.bin.name,
            row: location.bin.row,
          },
          quantity: actualQty,
        },
      ];

      this._logger.log('data create returnItem', locations, actualQty);
      await ReturnItem.create({
        userId: user.id,
        itemId: item.id,
        workOrders: item.workOrders,
        locations,
        quantity: actualQty,
        binId: bin.id,
      });
    }
  }

  private async _formatListWo(listWo: any[]): Promise<any[]> {
    const mergedObject: Record<string, any> = {};
    listWo.forEach((obj) => {
      const keys = [obj.wo, obj.area];
      const key = keys.join('_');

      if (!mergedObject[key]) {
        mergedObject[key] = {};
      }
      Object.assign(mergedObject[key], obj);
    });
    return Object.values(mergedObject);
  }

  private async _deleteProcess(processName: string, mqttClient: MqttClient): Promise<void> {
    mqttClient.publish('processItem/success', JSON.stringify({}));
  }
}
