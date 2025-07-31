// ===== ENHANCED TYPE DEFINITIONS =====

import axios from 'axios';
import * as https from 'https';

// Enhanced interfaces to match original logic
interface DeviceData {
  hardware_port: string;
  id: number;
  name: string;
  part_number: string;
  port_id: number;
  total_qty: number;
  qty: number;
  status: string;
  item_id: string;
  weight?: number;
  calcQuantity?: number;
  changeqty?: number;
  damageQuantity?: number;
}

interface ProcessItemData extends ItemData {
  request_qty: number;
  pre_qty: number;
  request_items: ItemData[];
  storage_items: ItemData[];
  condition_id: number;
  listWO?: WorkOrder[];
}

interface TransactionLocation {
  cabinet: Cabinet;
  bin: Bin;
  spares: ProcessedItem[];
}

interface ProcessedItem {
  id: string;
  name: string;
  part_no: string;
  material_no: string;
  item_type_id: string;
  type: string;
  condition_id: number;
  quantity: number;
  previous_qty: number;
  current_qty: number;
  changed_qty: number;
  listWO?: WorkOrder[];
}

interface DamageItem {
  deviceId: number;
  binId: string;
  damageQty: number;
}

// Enhanced item state to include inventory processing
enum ItemState {
  PENDING = 'PENDING',
  BIN_OPENING = 'BIN_OPENING',
  LOCK_OPENING = 'LOCK_OPENING',
  LOCK_OPENED = 'LOCK_OPENED',
  WAITING_FOR_CLOSURE = 'WAITING_FOR_CLOSURE',
  INVENTORY_CALCULATING = 'INVENTORY_CALCULATING',
  DAMAGE_PROCESSING = 'DAMAGE_PROCESSING',
  RETURN_ITEMS_PROCESSING = 'RETURN_ITEMS_PROCESSING',
  CLOSING = 'CLOSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

enum ItemEvent {
  START_BIN_OPEN = 'START_BIN_OPEN',
  BIN_OPENED = 'BIN_OPENED',
  BIN_FAILED = 'BIN_FAILED',
  LOCK_OPENED = 'LOCK_OPENED',
  LOCK_FAILED = 'LOCK_FAILED',
  LOCK_CLOSED = 'LOCK_CLOSED',
  INVENTORY_CALCULATED = 'INVENTORY_CALCULATED',
  INVENTORY_FAILED = 'INVENTORY_FAILED',
  DAMAGE_PROCESSED = 'DAMAGE_PROCESSED',
  RETURN_ITEMS_PROCESSED = 'RETURN_ITEMS_PROCESSED',
  CLOSED = 'CLOSED',
  CLOSE_FAILED = 'CLOSE_FAILED',
  RETRY = 'RETRY',
  SKIP = 'SKIP',
}

// ===== ENHANCED SERVICE INTERFACES =====

interface IDeviceService {
  getListDevice(condition: any): Promise<DeviceData[]>;
  updateDamageQuantity(deviceId: number, damageQty: number): Promise<void>;
}

interface IInventoryService {
  calculateInventoryChanges(
    currentDevices: DeviceData[],
    newDevices: DeviceData[],
    items: ProcessItemData[],
  ): Promise<{
    logData: TransactionLocation;
    isNextRequestItem: boolean;
    damageItems: DamageItem[];
  }>;
}

interface IReturnItemService {
  handleIssueTransaction(transaction: any, user: User, binId: string): Promise<void>;
  handleReturnTransaction(transaction: any, user: User, binId: string): Promise<void>;
  formatListWo(listWo: WorkOrder[]): Promise<WorkOrder[]>;
}

interface ILockService {
  openLock(deviceId: string, lockIds: string | string[]): Promise<{ success: boolean; results: any[]; error?: string }>;
  checkLockStatus(deviceId: string, lockIds: string[]): Promise<{ status: string; isAllClosed: boolean }>;
}

// ===== ENHANCED DATABASE SERVICE =====

class EnhancedDatabaseService implements IDatabaseService {
  // ... previous methods ...

  async getTransaction(transactionId: string): Promise<any> {
    // Implementation depends on your ORM
    throw new Error('Method not implemented');
  }

  async updateTransaction(transactionId: string, updates: any): Promise<any> {
    // Implementation depends on your ORM
    throw new Error('Method not implemented');
  }

  async getDevice(deviceId: number): Promise<any> {
    // Implementation depends on your ORM
    throw new Error('Method not implemented');
  }

  async updateDevice(deviceId: number, updates: any): Promise<any> {
    // Implementation depends on your ORM
    throw new Error('Method not implemented');
  }

  async getReturnItem(userId: string, itemId: string, binId?: string): Promise<any> {
    // Implementation depends on your ORM
    throw new Error('Method not implemented');
  }

  async createReturnItem(data: any): Promise<any> {
    // Implementation depends on your ORM
    throw new Error('Method not implemented');
  }

  async updateReturnItem(returnItem: any, updates: any): Promise<any> {
    // Implementation depends on your ORM
    throw new Error('Method not implemented');
  }

  async deleteReturnItem(returnItem: any): Promise<void> {
    // Implementation depends on your ORM
    throw new Error('Method not implemented');
  }

  async getItemTypes(condition: any): Promise<any[]> {
    // Implementation depends on your ORM
    throw new Error('Method not implemented');
  }
}

// ===== DEVICE SERVICE IMPLEMENTATION =====

class DeviceService implements IDeviceService {
  constructor(private db: EnhancedDatabaseService) {}

  async getListDevice(condition: any): Promise<DeviceData[]> {
    try {
      // This logic is from transactionServiceV2.js
      const devices = await this.db.getDevicesWithCondition(condition);

      if (!devices || devices.length === 0) {
        return [];
      }

      const now = Date.now();
      // Filter online devices (heartbeat within 30 seconds)
      const onlineDevices = devices.filter((device) => parseInt(device.heartbeat) > now - 30 * 1000);

      return onlineDevices.map((device) => ({
        hardware_port: device.port?.path || '',
        id: device.deviceId,
        name: device.deviceDescription?.name || '',
        part_number: device.deviceDescription?.partNumber || '',
        port_id: device.deviceId % 100,
        total_qty: device.calcQuantity,
        qty: parseInt(device.quantity) + device.changeqty,
        status: device.status,
        item_id: device.itemId,
        weight: device.weight,
        calcQuantity: device.calcQuantity,
        changeqty: device.changeqty,
        damageQuantity: device.damageQuantity || 0,
      }));
    } catch (error) {
      console.error('Error getting device list:', error);
      return [];
    }
  }

  async updateDamageQuantity(deviceId: number, damageQty: number): Promise<void> {
    const device = await this.db.getDevice(deviceId);
    if (device) {
      await this.db.updateDevice(deviceId, {
        damageQuantity: device.damageQuantity + damageQty,
      });
    }
  }
}

// ===== INVENTORY SERVICE IMPLEMENTATION =====

class InventoryService implements IInventoryService {
  constructor(
    private deviceService: IDeviceService,
    private config: { CONDITION_WORKING_ID: number; PROCESS_ITEM_TYPE: any },
  ) {}

  async calculateInventoryChanges(
    currentDevices: DeviceData[],
    newDevices: DeviceData[],
    items: ProcessItemData[],
  ): Promise<{
    logData: TransactionLocation;
    isNextRequestItem: boolean;
    damageItems: DamageItem[];
  }> {
    const logData: TransactionLocation = {
      cabinet: items[0]?.cabinet || ({} as Cabinet),
      bin: items[0]?.bin || ({} as Bin),
      spares: [],
    };

    let isNextRequestItem = true;
    const damageItems: DamageItem[] = [];
    const allItems = [...(items[0]?.request_items || []), ...(items[0]?.storage_items || [])];

    if (newDevices.length > 0 && currentDevices.length > 0) {
      for (const newDevice of newDevices) {
        const currentDeviceIndex = currentDevices.findIndex((d) => d.id === newDevice.id);

        if (currentDeviceIndex < 0) {
          console.log('Device not found in current list:', newDevice.id);
          continue;
        }

        const currentDevice = currentDevices[currentDeviceIndex];
        const item = allItems.find((item) => item.id === currentDevice.item_id);

        if (!item) {
          console.log('Item not found for device:', currentDevice.item_id);
          continue;
        }

        const changedQty = newDevice.qty - item.pre_qty;
        const actualQty = Math.abs(changedQty);
        const requestQty = item.request_qty;

        const logItem: ProcessedItem = {
          id: item.id,
          name: item.name || '',
          part_no: item.part_no || '',
          material_no: item.material_no || '',
          item_type_id: item.item_type_id || '',
          type: item.type,
          condition_id: item.condition_id === 0 ? this.config.CONDITION_WORKING_ID : item.condition_id,
          quantity: actualQty,
          previous_qty: item.pre_qty,
          current_qty: parseInt(newDevice.qty.toString()),
          changed_qty: changedQty,
        };

        if (item.listWO) {
          logItem.listWO = item.listWO;
        }

        if (actualQty !== 0) {
          logData.spares.push(logItem);
        }

        // Check if actual quantity matches request
        if (actualQty !== requestQty) {
          isNextRequestItem = false;
        }

        // Handle damage items for RETURN transactions
        if (isNextRequestItem && item.type === this.config.PROCESS_ITEM_TYPE.RETURN && requestQty !== 0 && item.condition_id !== 0) {
          damageItems.push({
            deviceId: currentDevice.id,
            binId: logData.bin.id,
            damageQty: changedQty,
          });
        }
      }
    }

    return { logData, isNextRequestItem, damageItems };
  }
}

// ===== RETURN ITEM SERVICE IMPLEMENTATION =====

class ReturnItemService implements IReturnItemService {
  constructor(
    private db: EnhancedDatabaseService,
    private config: { PROCESS_ITEM_TYPE: any },
  ) {}

  async formatListWo(listWo: WorkOrder[]): Promise<WorkOrder[]> {
    // Logic from processItemByRequest.js
    const mergedObject: Record<string, WorkOrder> = {};

    listWo.forEach((obj) => {
      const key = [obj.wo, obj.area].join('_');
      if (!mergedObject[key]) {
        mergedObject[key] = {} as WorkOrder;
      }
      Object.assign(mergedObject[key], obj);
    });

    return Object.values(mergedObject);
  }

  async handleIssueTransaction(transaction: any, user: User, binId: string): Promise<void> {
    // Logic from processItemByRequest.js for ISSUE transactions
    const itemTypeReplenish = (await this.db.getItemTypes({ is_return: 0 })).map((item) => item.type);

    for (const location of transaction.locations) {
      if (location.bin.id === binId) {
        for (const item of location.spares) {
          const actualQty = Math.abs(item.changed_qty);

          if (!itemTypeReplenish.includes(item.type) && actualQty !== 0) {
            const existingReturnItem = await this.db.getReturnItem(user.id, item.id, binId);

            if (existingReturnItem) {
              await this.updateExistingReturnItem(existingReturnItem, location, actualQty, item);
            } else {
              await this.createNewReturnItem(user.id, item, location, actualQty, binId);
            }
          }
        }
      }
    }
  }

  async handleReturnTransaction(transaction: any, user: User, binId: string): Promise<void> {
    // Logic from processItemByRequest.js for RETURN transactions
    for (const location of transaction.locations) {
      if (location.bin.id === binId) {
        for (const item of location.spares) {
          const actualQty = Math.abs(item.changed_qty);
          const existingReturnItem = await this.db.getReturnItem(user.id, item.id);

          if (existingReturnItem) {
            const updatedLocations = existingReturnItem.locations.map((loc: any) => {
              if (loc.bin.id === binId) {
                loc.quantity -= actualQty;
              }
              return loc;
            });

            const updates = {
              locations: updatedLocations,
              quantity: existingReturnItem.quantity - actualQty,
            };

            if (updates.quantity <= 0) {
              await this.db.deleteReturnItem(existingReturnItem);
            } else {
              await this.db.updateReturnItem(existingReturnItem, updates);
            }
          }
        }
      }
    }
  }

  private async updateExistingReturnItem(returnItem: any, location: any, actualQty: number, item: any): Promise<void> {
    const existingLocationIndex = returnItem.locations.findIndex((loc: any) => loc.bin.id === location.bin.id);

    let updatedLocations;
    if (existingLocationIndex >= 0) {
      updatedLocations = returnItem.locations.map((loc: any, index: number) => {
        if (index === existingLocationIndex) {
          return { ...loc, quantity: loc.quantity + actualQty };
        }
        return loc;
      });
    } else {
      updatedLocations = [...returnItem.locations, this.createLocationObject(location, actualQty)];
    }

    let updatedListWo = returnItem.listWo;
    if (returnItem.listWo && item.listWO) {
      const combinedWo = [...returnItem.listWo, ...item.listWO];
      updatedListWo = await this.formatListWo(combinedWo);
    }

    await this.db.updateReturnItem(returnItem, {
      locations: updatedLocations,
      quantity: returnItem.quantity + actualQty,
      listWo: updatedListWo,
    });
  }

  private async createNewReturnItem(userId: string, item: any, location: any, actualQty: number, binId: string): Promise<void> {
    await this.db.createReturnItem({
      userId,
      itemId: item.id,
      listWo: item.listWO,
      locations: [this.createLocationObject(location, actualQty)],
      quantity: actualQty,
      binId,
    });
  }

  private createLocationObject(location: any, quantity: number): any {
    return {
      cabinet: {
        id: location.cabinet.id,
        name: location.cabinet.name,
      },
      bin: {
        id: location.bin.id,
        name: location.bin.name,
        row: location.bin.row,
      },
      quantity,
    };
  }
}

// ===== ENHANCED LOCK SERVICE =====

class LockService implements ILockService {
  private httpsAgent: https.Agent;
  private token: string;

  constructor(token: string) {
    this.token = token;
    this.httpsAgent = new https.Agent({ rejectUnauthorized: false });
  }

  async openLock(deviceId: string, lockIds: string | string[]): Promise<{ success: boolean; results: any[]; error?: string }> {
    try {
      const config = {
        method: 'post' as const,
        url: 'http://localhost:3000/api/lock/open',
        httpsAgent: this.httpsAgent,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          deviceType: 'CU',
          deviceId,
          lockID: Array.isArray(lockIds) ? lockIds : [lockIds],
        }),
      };

      const response = await axios(config);
      return {
        success: response.data.results && response.data.results.length > 0,
        results: response.data.results || [],
      };
    } catch (error) {
      console.error('Lock open failed:', error);
      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkLockStatus(deviceId: string, lockIds: string[]): Promise<{ status: string; isAllClosed: boolean }> {
    try {
      const config = {
        method: 'post' as const,
        url: 'http://localhost:3000/api/lock/status',
        httpsAgent: this.httpsAgent,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          deviceType: 'CU',
          deviceId,
          lockID: lockIds,
        }),
      };

      const response = await axios(config);

      if (response.status === 200 && response.data.results.length > 0) {
        const allClosed = response.data.results.every((res: any) => res.status !== 'Open');
        return {
          status: allClosed ? 'Closed' : 'Open',
          isAllClosed: allClosed,
        };
      }

      return { status: 'Unknown', isAllClosed: false };
    } catch (error) {
      console.error('Lock status check failed:', error);
      return { status: 'Error', isAllClosed: false };
    }
  }
}

// ===== ENHANCED STATE MACHINE =====

class EnhancedStateMachine extends StateMachine {
  private deviceService: IDeviceService;
  private inventoryService: IInventoryService;
  private returnItemService: IReturnItemService;
  private lockService: ILockService;
  private config: any;

  constructor(db: IDatabaseService, queue: IQueueService, mqtt: IMqttService, token: string, config: any) {
    const lockService = new LockService(token);
    super(db, queue, mqtt, lockService);

    this.deviceService = new DeviceService(db as EnhancedDatabaseService);
    this.inventoryService = new InventoryService(this.deviceService, config);
    this.returnItemService = new ReturnItemService(db as EnhancedDatabaseService, config);
    this.lockService = lockService;
    this.config = config;
  }

  protected defineItemTransitions(): StateTransitions<ItemState, ItemEvent> {
    return {
      [ItemState.PENDING]: {
        [ItemEvent.START_BIN_OPEN]: ItemState.BIN_OPENING,
      },
      [ItemState.BIN_OPENING]: {
        [ItemEvent.BIN_OPENED]: ItemState.LOCK_OPENING,
        [ItemEvent.BIN_FAILED]: ItemState.FAILED,
      },
      [ItemState.LOCK_OPENING]: {
        [ItemEvent.LOCK_OPENED]: ItemState.LOCK_OPENED,
        [ItemEvent.LOCK_FAILED]: ItemState.FAILED,
      },
      [ItemState.LOCK_OPENED]: {
        [ItemEvent.LOCK_CLOSED]: ItemState.WAITING_FOR_CLOSURE,
      },
      [ItemState.WAITING_FOR_CLOSURE]: {
        [ItemEvent.INVENTORY_CALCULATED]: ItemState.INVENTORY_CALCULATING,
      },
      [ItemState.INVENTORY_CALCULATING]: {
        [ItemEvent.DAMAGE_PROCESSED]: ItemState.DAMAGE_PROCESSING,
        [ItemEvent.INVENTORY_FAILED]: ItemState.FAILED,
      },
      [ItemState.DAMAGE_PROCESSING]: {
        [ItemEvent.RETURN_ITEMS_PROCESSED]: ItemState.RETURN_ITEMS_PROCESSING,
      },
      [ItemState.RETURN_ITEMS_PROCESSING]: {
        [ItemEvent.CLOSED]: ItemState.CLOSING,
      },
      [ItemState.CLOSING]: {
        [ItemEvent.CLOSED]: ItemState.COMPLETED,
        [ItemEvent.CLOSE_FAILED]: ItemState.FAILED,
      },
      [ItemState.FAILED]: {
        [ItemEvent.RETRY]: ItemState.PENDING,
        [ItemEvent.SKIP]: ItemState.COMPLETED,
      },
      [ItemState.COMPLETED]: {},
    };
  }

  protected defineItemHandlers(): StateHandlers<ItemState> {
    return {
      [ItemState.BIN_OPENING]: this.handleBinOpening.bind(this),
      [ItemState.LOCK_OPENING]: this.handleLockOpening.bind(this),
      [ItemState.LOCK_OPENED]: this.handleLockOpened.bind(this),
      [ItemState.WAITING_FOR_CLOSURE]: this.handleWaitingForClosure.bind(this),
      [ItemState.INVENTORY_CALCULATING]: this.handleInventoryCalculating.bind(this),
      [ItemState.DAMAGE_PROCESSING]: this.handleDamageProcessing.bind(this),
      [ItemState.RETURN_ITEMS_PROCESSING]: this.handleReturnItemsProcessing.bind(this),
      [ItemState.CLOSING]: this.handleItemClosing.bind(this),
      [ItemState.COMPLETED]: this.handleItemCompleted.bind(this),
      [ItemState.FAILED]: this.handleItemFailed.bind(this),
    };
  }

  // ===== ENHANCED HANDLERS =====

  private async handleLockOpened(itemId: string, data: any): Promise<void> {
    console.log(`Lock opened for item ${itemId}, waiting for user interaction...`);

    // Update bin status to unlocked
    await (this.db as EnhancedDatabaseService).updateBinStatus(data.binId, {
      is_locked: false,
      count_failed: 0,
    });

    // Publish MQTT event (equivalent to original lock/openSuccess)
    this.mqtt.publish('lock/openSuccess', {
      itemId,
      processId: data.processId,
      deviceType: 'CU',
      deviceId: data.binId,
      lockId: data.lockId,
      user: data.user,
      type: data.type,
      data: data.itemData,
      transId: data.processId,
      is_final: data.is_final || false,
    });

    // Start waiting for lock closure
    await this.queue.add(
      'item.wait_for_closure',
      {
        itemId,
        processId: data.processId,
        timeout: 60 * 60 * 1000, // 1 hour timeout
        timestamp: new Date(),
      },
      { delay: 2000 },
    );
  }

  private async handleWaitingForClosure(itemId: string, data: any): Promise<void> {
    const item = await this.db.getItemState(itemId);
    if (!item) return;

    // Check if lock is closed (logic from transactionServiceV2.js)
    const lockStatus = await this.lockService.checkLockStatus(data.deviceId, [data.lockId]);

    if (lockStatus.isAllClosed) {
      console.log(`Lock closed for item ${itemId}, starting inventory calculation...`);
      await this.transition('item', itemId, ItemEvent.INVENTORY_CALCULATED, data);
    } else {
      // Check timeout
      const timeWaiting = Date.now() - item.updatedAt.getTime();
      if (timeWaiting > data.timeout) {
        console.error(`Timeout waiting for lock closure: ${itemId}`);
        await this.transition('item', itemId, ItemEvent.INVENTORY_FAILED, {
          error: 'Timeout waiting for lock closure',
        });
      } else {
        // Continue waiting
        await this.queue.add('item.wait_for_closure', data, { delay: 1000 });
      }
    }
  }

  private async handleInventoryCalculating(itemId: string, data: any): Promise<void> {
    try {
      console.log(`Starting inventory calculation for item ${itemId}...`);

      // Get current and new device data
      const currentDevices = data.currentDevices || (await this.deviceService.getListDevice({}));
      const newDevices = await this.deviceService.getListDevice({ binId: data.binId });

      // Calculate inventory changes (logic from transactionServiceV2.js)
      const result = await this.inventoryService.calculateInventoryChanges(currentDevices, newDevices, [data.itemData]);

      // Update transaction with calculated data
      const transaction = await (this.db as EnhancedDatabaseService).getTransaction(data.processId);
      if (transaction && result.logData.spares.length > 0) {
        await (this.db as EnhancedDatabaseService).updateTransaction(data.processId, {
          locations_temp: [...transaction.locations, result.logData],
        });
      }

      // Store calculation results for next steps
      const enhancedData = {
        ...data,
        calculationResult: result,
        isNextRequestItem: result.isNextRequestItem,
      };

      if (!result.isNextRequestItem) {
        // Publish error event (equivalent to original error handling)
        this.mqtt.publish(`${data.type}/error`, {
          data: {
            ...result.logData,
            request_items: data.itemData.request_items || [],
          },
        });

        this.mqtt.publish('process-item/error', {
          isCloseWarningPopup: false,
          type: data.type,
        });
      }

      await this.transition('item', itemId, ItemEvent.DAMAGE_PROCESSED, enhancedData);
    } catch (error) {
      console.error(`Inventory calculation failed for item ${itemId}:`, error);
      await this.transition('item', itemId, ItemEvent.INVENTORY_FAILED, {
        error: error instanceof Error ? error.message : 'Inventory calculation failed',
      });
    }
  }

  private async handleDamageProcessing(itemId: string, data: any): Promise<void> {
    try {
      console.log(`Processing damage items for item ${itemId}...`);

      const result = data.calculationResult;

      // Handle damage items (logic from transactionServiceV2.js)
      if (result.isNextRequestItem && result.damageItems.length > 0) {
        for (const damageItem of result.damageItems) {
          await this.deviceService.updateDamageQuantity(damageItem.deviceId, damageItem.damageQty);

          // Mark bin as damaged
          await (this.db as EnhancedDatabaseService).updateBinStatus(damageItem.binId, {
            is_damage: 1,
          });
        }
      }

      await this.transition('item', itemId, ItemEvent.RETURN_ITEMS_PROCESSED, data);
    } catch (error) {
      console.error(`Damage processing failed for item ${itemId}:`, error);
      await this.transition('item', itemId, ItemEvent.INVENTORY_FAILED, {
        error: error instanceof Error ? error.message : 'Damage processing failed',
      });
    }
  }

  private async handleReturnItemsProcessing(itemId: string, data: any): Promise<void> {
    try {
      console.log(`Processing return items for item ${itemId}...`);

      const result = data.calculationResult;

      if (result.isNextRequestItem) {
        // Update transaction locations (logic from processItemByRequest.js)
        const transaction = await (this.db as EnhancedDatabaseService).getTransaction(data.processId);
        if (transaction) {
          await (this.db as EnhancedDatabaseService).updateTransaction(data.processId, {
            locations: transaction.locations_temp,
            locations_temp: [],
          });

          // Handle return items based on transaction type
          if (transaction.type === this.config.PROCESS_ITEM_TYPE.ISSUE) {
            await this.returnItemService.handleIssueTransaction(transaction, data.user, data.binId);
          } else if (transaction.type === this.config.PROCESS_ITEM_TYPE.RETURN) {
            await this.returnItemService.handleReturnTransaction(transaction, data.user, data.binId);
          }
        }
      }

      await this.transition('item', itemId, ItemEvent.CLOSED, data);
    } catch (error) {
      console.error(`Return items processing failed for item ${itemId}:`, error);
      await this.transition('item', itemId, ItemEvent.INVENTORY_FAILED, {
        error: error instanceof Error ? error.message : 'Return items processing failed',
      });
    }
  }

  private async handleItemClosing(itemId: string, data: any): Promise<void> {
    console.log(`Closing item ${itemId}...`);

    // Lock the bin back (logic from processItemByRequest.js)
    await (this.db as EnhancedDatabaseService).updateBinStatus(data.binId, {
      is_locked: true,
    });

    // Publish bin close event
    this.mqtt.publish('bin/close', {
      itemId,
      processId: data.processId,
      deviceType: 'CU',
      deviceId: data.binId,
      lockId: data.lockId,
      user: data.user,
      type: data.type,
      data: data.itemData,
      transId: data.processId,
    });

    // Publish completion status
    this.mqtt.publish('process-item/status', {
      isProcessingItem: false,
      isNextRequestItem: data.isNextRequestItem || true,
    });

    await this.transition('item', itemId, ItemEvent.CLOSED, data);
  }

  protected async handleItemCompleted(itemId: string, data: any): Promise<void> {
    console.log(`Item ${itemId} completed successfully`);

    // Move to next item or complete process (logic from processItemByRequest.js)
    const item = await this.db.getItemState(itemId);
    if (!item) return;

    const process = await this.db.getProcess(item.processId);
    if (!process) return;

    const nextItemIndex = item.itemIndex + 1;

    if (nextItemIndex >= process.totalItems) {
      // All items completed - update transaction status
      await (this.db as EnhancedDatabaseService).updateTransaction(item.processId, {
        name: `trans#${item.processId}`,
        status: 'done',
      });

      // Publish completion and cleanup
      this.mqtt.publish('processItem/success', {});

      await this.transition('process', item.processId, ProcessEvent.COMPLETE);
    } else {
      // Process next item
      await this.queue.add('process.next_item', {
        processId: item.processId,
        itemIndex: nextItemIndex,
        timestamp: new Date(),
      });
    }
  }
}

// ===== ENHANCED QUEUE PROCESSOR =====

class EnhancedQueueProcessor extends QueueProcessor {
  private deviceService: IDeviceService;

  constructor(stateMachine: StateMachine, mqtt: IMqttService, queue: IQueueService, db: IDatabaseService, deviceService: IDeviceService) {
    super(stateMachine, mqtt, queue, db);
    this.deviceService = deviceService;
  }

  protected setupJobHandlers(): void {
    super.setupJobHandlers();

    // Additional handlers
    this.queue.process('item.wait_for_closure', this.handleWaitForClosure.bind(this));
  }

  private async handleWaitForClosure(job: { data: any }): Promise<void> {
    const { itemId } = job.data;
    await (this.stateMachine as EnhancedStateMachine).transition('item', itemId, ItemEvent.LOCK_CLOSED, job.data);
  }

  protected async handleOpenBin(job: { data: ItemJobData }): Promise<void> {
    const { itemId, binId } = job.data;

    // Get current devices for inventory comparison
    const currentDevices = await this.deviceService.getListDevice({});

    // Reset device weight (logic from processItemByRequest.js)
    const device = await this.db.getDevice(binId);
    if (device) {
      await this.db.updateDevice(device.deviceId, {
        zeroWeight: device.weight,
      });
    }

    const enhancedData = {
      ...job.data,
      currentDevices,
    };

    await this.stateMachine.transition('item', itemId, ItemEvent.START_BIN_OPEN, enhancedData);
  }
}

// ===== FACTORY FUNCTION WITH ENHANCED SERVICES =====

export async function createEnhancedItemProcessingSystem(
  config: SystemConfig & {
    token: string;
    constants: {
      CONDITION_WORKING_ID: number;
      PROCESS_ITEM_TYPE: any;
      TIME_WAIT: number;
    };
  },
): Promise<ItemProcessingSystem> {
  const db = new EnhancedDatabaseService();
  const mqtt = {} as IMqttService; // Your MQTT service implementation
  const queue = {} as IQueueService; // Your Queue service implementation
  const deviceService = new DeviceService(db);

  const stateMachine = new EnhancedStateMachine(db, queue, mqtt, config.token, config.constants);
  const queueProcessor = new EnhancedQueueProcessor(stateMachine, mqtt, queue, db, deviceService);
  const recoveryService = new RecoveryService(stateMachine, queue, db, config.recovery);

  const system = new ItemProcessingSystem(config, db, mqtt, queue, {} as ILockService);
  await system.initialize();

  return system;
}

// ===== USAGE EXAMPLE =====

/*
const config = {
  mqtt: { url: 'mqtt://localhost:1883' },
  queue: { redis: { host: 'localhost', port: 6379 } },
  database: {},
  token: process.env.LONG_TERM_TOKEN,
  constants: {
    CONDITION_WORKING_ID: 12,
    PROCESS_ITEM_TYPE: { ISSUE: 'issue', RETURN: 'return' },
    TIME_WAIT: 1000
  },
  recovery: {
    maxProcessAge: 4 * 60 * 60 * 1000,
    maxItemStateAge: 45 * 60 * 1000
  }
};

const system = await createEnhancedItemProcessingSystem(config);

// Start processing (equivalent to original processItemByRequest.js)
const processId = await system.startProcess({
  type: 'issue',
  user: { id: 'user123', userLogin: 'john.doe', userRole: 'operator' },
  items: [
    {
      id: 'item1',
      type: 'consumable',
      bin: { id: 'bin1', cu_id: 'cu001', lock_id: 'lock001' },
      cabinet: { id: 'cab1', name: 'Cabinet 1' },
      request_qty: 5,
      pre_qty: 10,
      request_items: [],
      storage_items: [],
      condition_id: 0
    }
  ],
  requestQty: 5,
  uniqueId: 'tablet001'
});

console.log('Process started:', processId);
*/

export {
  EnhancedStateMachine,
  EnhancedQueueProcessor,
  DeviceService,
  InventoryService,
  ReturnItemService,
  LockService,
  ItemState,
  ItemEvent,
};
