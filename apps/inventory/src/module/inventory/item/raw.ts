// ========== 1. Types & Interfaces (types/process-item.types.ts) ==========

// ========== 3. BullMQ Job Processor (process-item.processor.ts) ==========
import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ProcessItemService } from './process-item.service';

@Processor('process-item')
export class ProcessItemProcessor {
  private readonly logger = new Logger(ProcessItemProcessor.name);

  constructor(private readonly processItemService: ProcessItemService) {}

  @Process()
  async handleProcessItem(job: Job<ProcessItemJobData>) {
    this.logger.log(`Starting job ${job.id} - type: ${job.data.type}, items: ${job.data.data.length}`);

    try {
      await this.processItemService.processItems(job.id.toString(), job.data);
      this.logger.log(`Job ${job.id} completed successfully`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }
}

// ========== 4. Main Service (process-item.service.ts) ==========
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import axios from 'axios';
import * as https from 'https';
import { exec } from 'child_process';
import { ProcessItemStateMachine, ProcessState, ProcessEvent } from './state-machine/process-item.state-machine';

// Import your Sequelize models
import { Bin } from '../models/Bin';
import { Transaction } from '../models/Transaction';
import { Tablet } from '../models/Tablet';
import { Device } from '../models/Device';
import { ItemType } from '../models/ItemType';
import { ReturnItem } from '../models/ReturnItem';
import { PROCESS_ITEM_TYPE } from '../lib/constant';

@Injectable()
export class ProcessItemService implements OnModuleDestroy {
  private readonly logger = new Logger(ProcessItemService.name);
  private mqttClients = new Map<string, MqttClient>();
  private stateMachines = new Map<string, ProcessItemStateMachine>();

  constructor(@InjectQueue('process-item') private processQueue: Queue) {}

  async onModuleDestroy() {
    // Cleanup all MQTT connections
    for (const [jobId, client] of this.mqttClients) {
      client.end();
    }
  }

  async createProcessJob(data: ProcessItemJobData): Promise<Job> {
    return this.processQueue.add(data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async processItems(jobId: string, data: ProcessItemJobData): Promise<void> {
    const { token, type, user, data: items, request_qty, uniqueId } = data;
    const deviceType = 'CU';
    const processName = `serial-user/${type}/${user.id}`;

    console.log('user', user);
    console.log('data', items);

    // Initialize state machine
    const stateMachine = new ProcessItemStateMachine(items.length);
    this.stateMachines.set(jobId, stateMachine);

    // Start state machine
    stateMachine.transition(ProcessEvent.START);

    try {
      // Connect MQTT
      const mqttClient = await this.connectMqtt(jobId, stateMachine);
      this.mqttClients.set(jobId, mqttClient);

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

        this.logger.log(`Processing item ${context.currentItemIndex + 1}/${items.length}`);

        // Check if we should process this item
        if (stateMachine.getState() === ProcessState.READY || stateMachine.getState() === ProcessState.PROCESSING_NEXT) {
          stateMachine.transition(ProcessEvent.PROCESS_ITEM, {
            currentItem: item,
            currentBin: item.bin,
          });

          await this.processItem(
            stateMachine,
            mqttClient,
            token,
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
      await this.deleteProcess(processName, mqttClient);
    } catch (error) {
      this.logger.error('Error processing items:', error);
      stateMachine.transition(ProcessEvent.ERROR_OCCURRED, { error });
      throw error;
    } finally {
      // Cleanup
      this.stateMachines.delete(jobId);
      const client = this.mqttClients.get(jobId);
      if (client) {
        client.end();
        this.mqttClients.delete(jobId);
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
      mqttClient.on('message', async (topic, message) => {
        console.log(topic, message.toString());

        switch (topic) {
          case 'bin/openFail':
            await this.handleBinOpenFail(JSON.parse(message.toString()), mqttClient);
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
    const bin = await Bin.findOne({ where: { id: item.bin.id } });

    if (bin.is_failed) {
      stateMachine.transition(ProcessEvent.SKIP_ITEM, {
        currentItemIndex: stateMachine.getContext().currentItemIndex + 1,
      });
      return;
    }

    // Update device zero weight
    const device = await Device.findOne({ where: { binId: bin.id } });
    await device.update({ zeroWeight: device.weight });

    const mqttData: MqttMessage = {
      deviceType,
      deviceId: bin.cu_id,
      lockId: bin.lock_id,
      user,
      type: stateMachine.getContext().currentItem!.bin.id === item.bin.id ? 'issue' : 'return',
      data: item,
      transId: transactionId,
      is_final: isFinal,
    };

    console.log('mqttData processItemByRequest', mqttData);

    // Trigger loadcells calculate
    mqttClient.publish('bin/open', JSON.stringify(mqttData));
    await this.wait(1500);

    // Open lock
    const lockOpened = await this.openLock(token, deviceType, bin);

    if (!lockOpened) {
      await this.handleLockOpenFailure(stateMachine, mqttClient, bin, item);
      return;
    }

    // Lock opened successfully
    bin.is_locked = 0;
    bin.count_failed = 0;
    await bin.save();

    mqttClient.publish('lock/openSuccess', JSON.stringify(mqttData));
    stateMachine.transition(ProcessEvent.LOCK_OPEN_SUCCESS);

    // Wait for user action
    await this.wait(2000);
    await this.waitForUserAction(stateMachine);

    // Update status lock
    bin.is_locked = 1;
    await bin.save();

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

  private async openLock(token: string, deviceType: string, bin: BinData): Promise<boolean> {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const config = {
      method: 'post' as const,
      url: 'http://localhost:3000/api/lock/open',
      httpsAgent,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        deviceType,
        deviceId: bin.cu_id,
        lockID: [bin.lock_id],
      }),
    };

    try {
      const response = await axios(config);
      console.log('open-bin', response.data.results.length);
      return response.data.results.length > 0;
    } catch (error) {
      console.error('Error opening lock:', error);
      return false;
    }
  }

  private async handleLockOpenFailure(
    stateMachine: ProcessItemStateMachine,
    mqttClient: MqttClient,
    bin: BinData,
    item: ItemData,
  ): Promise<void> {
    bin.count_failed = (bin.count_failed || 0) + 1;
    await bin.save();

    let isSkip = false;
    if (bin.is_failed || bin.count_failed >= 3) {
      isSkip = true;
    } else {
      // Send mqtt openLockFail
      console.log('mqttData openLockFail', item);
      mqttClient.publish('lock/openFail', JSON.stringify(item));
    }

    while (!isSkip) {
      const updatedBin = await Bin.findOne({ where: { id: item.bin.id } });
      if (updatedBin.is_locked === 0) break;
      if (updatedBin.is_failed || updatedBin.count_failed >= 3) {
        isSkip = true;
      }
      await this.wait(1000);
    }

    console.log('is_skip', isSkip);
    if (isSkip) {
      stateMachine.transition(ProcessEvent.SKIP_ITEM, {
        currentItemIndex: stateMachine.getContext().currentItemIndex + 1,
      });
    } else {
      stateMachine.transition(ProcessEvent.LOCK_OPEN_SUCCESS);
    }
  }

  private async handleBinOpenFail(dataBin: { binId: number }, mqttClient: MqttClient): Promise<void> {
    const bin = await Bin.findOne({ where: { id: dataBin.binId } });
    if (!bin.is_failed) {
      // Find item in current context - would need to pass this through
      // For now, just log
      console.log('Bin open failed:', dataBin.binId);
    }
  }

  private async waitForUserAction(stateMachine: ProcessItemStateMachine): Promise<void> {
    console.log('isProcessingItem', stateMachine.getContext().isProcessingItem);
    while (stateMachine.getContext().isProcessingItem) {
      await this.wait(1000);
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

    console.log('check', type === PROCESS_ITEM_TYPE.ISSUE, transaction.locations);

    // Check to upsert returnItems
    if (type === PROCESS_ITEM_TYPE.ISSUE) {
      const itemTypeReplenish = (await ItemType.findAll({ where: { is_return: 0 } })).map((item: any) => item.type);

      // Item consumable isn't written in return_items table
      for (const location of transaction.locations) {
        console.log('location', location, bin.id);
        if (location.bin.id === bin.id) {
          for (const spare of location.spares) {
            const actualQty = Math.abs(spare.changed_qty);
            console.log('item type', spare.type, actualQty, itemTypeReplenish);

            if (!itemTypeReplenish.includes(spare.type) && actualQty !== 0) {
              await this.upsertReturnItem(user, bin, location, spare, actualQty);
            }
          }
        }
      }
    } else if (type === PROCESS_ITEM_TYPE.RETURN) {
      for (const location of transaction.locations) {
        console.log('location', location, bin.id);
        if (location.bin.id === bin.id) {
          for (const spare of location.spares) {
            const actualQty = Math.abs(spare.changed_qty);
            console.log('item type', spare.type, actualQty);

            const getReturnItemByUser = await ReturnItem.findOne({
              where: {
                userId: user.id,
                itemId: spare.id,
              },
            });

            if (getReturnItemByUser) {
              const locations = getReturnItemByUser.locations.map((item: any) => {
                if (item.bin.id === bin.id) {
                  item.quantity -= actualQty;
                }
                return item;
              });

              getReturnItemByUser.locations = locations;
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

  private async upsertReturnItem(user: User, bin: BinData, location: LocationData, item: ItemSpare, actualQty: number): Promise<void> {
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
        console.log('aaaaaa', loc.bin.id);
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
        getReturnItemByUser.listWo = await this.formatListWo(listWo);
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

      console.log('data create returnItem', locations, actualQty);
      await ReturnItem.create({
        userId: user.id,
        itemId: item.id,
        listWo: item.listWO,
        locations,
        quantity: actualQty,
        binId: bin.id,
      });
    }
  }

  private async formatListWo(listWo: any[]): Promise<any[]> {
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

  private async deleteProcess(processName: string, mqttClient: MqttClient): Promise<void> {
    mqttClient.publish('processItem/success', JSON.stringify({}));
    exec(`pm2 delete ${processName}`);
    await this.wait(2000);
    console.log('delete done');
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ========== 5. Controller (process-item.controller.ts) ==========
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ProcessItemService } from './process-item.service';
import { ProcessItemJobData } from './types/process-item.types';

@Controller('process-item')
export class ProcessItemController {
  constructor(private readonly processItemService: ProcessItemService) {}

  @Post()
  async createProcessJob(@Body() data: ProcessItemJobData) {
    const job = await this.processItemService.createProcessJob(data);
    return {
      jobId: job.id,
      status: 'queued',
    };
  }

  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    // Implementation to get job status from BullMQ
    return {
      jobId,
      status: 'processing',
    };
  }
}

// ========== 6. Module (process-item.module.ts) ==========
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ProcessItemController } from './process-item.controller';
import { ProcessItemService } from './process-item.service';
import { ProcessItemProcessor } from './process-item.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'process-item',
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [ProcessItemController],
  providers: [ProcessItemService, ProcessItemProcessor],
  exports: [ProcessItemService],
})
export class ProcessItemModule {}

// ========== 7. Main App Module (app.module.ts) ==========
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProcessItemModule } from './process-item/process-item.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    SequelizeModule.forRoot({
      dialect: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadModels: true,
      synchronize: false,
    }),
    ProcessItemModule,
  ],
})
export class AppModule {}

// ========== 8. Usage Example ==========
// To start the process (replacing the original command line execution):
//
// POST http://localhost:3000/process-item
// {
//   "token": "xxx",
//   "type": "issue",
//   "user": {
//     "id": "123",
//     "user_cloud_id": "cloud-123",
//     "userLogin": "user@example.com",
//     "userRole": "operator"
//   },
//   "data": [
//     {
//       "bin": { "id": 1, "cu_id": "CU001", "lock_id": "L001", ... },
//       "cabinet": { "id": 1, "name": "Cabinet A" },
//       "spares": [...]
//     }
//   ],
//   "request_qty": 10,
//   "uniqueId": "tablet-123"
// }
