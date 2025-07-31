// ===== TYPE DEFINITIONS =====

// Enums for states and events
enum ProcessState {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

enum ItemState {
  PENDING = 'PENDING',
  BIN_OPENING = 'BIN_OPENING',
  LOCK_OPENING = 'LOCK_OPENING',
  PROCESSING = 'PROCESSING',
  CLOSING = 'CLOSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

enum ProcessEvent {
  START = 'START',
  COMPLETE = 'COMPLETE',
  FAIL = 'FAIL',
  RETRY = 'RETRY',
  RESTART = 'RESTART',
}

enum ItemEvent {
  START_BIN_OPEN = 'START_BIN_OPEN',
  BIN_OPENED = 'BIN_OPENED',
  BIN_FAILED = 'BIN_FAILED',
  LOCK_OPENED = 'LOCK_OPENED',
  LOCK_FAILED = 'LOCK_FAILED',
  PROCESSING_DONE = 'PROCESSING_DONE',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  CLOSED = 'CLOSED',
  CLOSE_FAILED = 'CLOSE_FAILED',
  RETRY = 'RETRY',
  SKIP = 'SKIP',
}

// Data models
interface User {
  id: string;
  user_cloud_id: string;
  userLogin: string;
  userRole: string;
}

interface Bin {
  id: string;
  name: string;
  row: string;
  cu_id: string;
  lock_id: string;
  is_locked: boolean;
  is_failed: boolean;
  count_failed: number;
}

interface Cabinet {
  id: string;
  name: string;
}

interface ItemData {
  id: string;
  type: string;
  bin: Bin;
  cabinet: Cabinet;
  changed_qty: number;
  listWO?: WorkOrder[];
}

interface WorkOrder {
  wo: string;
  area: string;
}

interface ProcessData {
  type: 'issue' | 'return';
  user: User;
  items: ItemData[];
  requestQty: number;
  uniqueId: string;
}

// Database models
interface ProcessStateModel {
  id: string;
  state: ProcessState;
  currentItemIndex: number;
  totalItems: number;
  data: ProcessData;
  checkpoints: Record<string, any>;
  errorCount: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

interface ItemStateModel {
  id: string;
  processId: string;
  itemIndex: number;
  state: ItemState;
  binId: string;
  lockId: string;
  retryCount: number;
  stepData: ItemData;
  createdAt: Date;
  updatedAt: Date;
}

// MQTT message types
interface MqttMessage {
  topic: string;
  payload: any;
  timestamp: Date;
}

interface BinOpenMessage {
  itemId: string;
  binId: string;
  deviceType: string;
  deviceId: string;
  lockId: string;
  user: User;
  type: string;
  data: ItemData;
  transId: string;
  is_final: boolean;
}

// Queue job types
interface BaseJobData {
  processId: string;
  timestamp: Date;
}

interface ProcessStartJobData extends BaseJobData {
  type: 'issue' | 'return';
  user: User;
  items: ItemData[];
  requestQty: number;
  uniqueId: string;
}

interface ItemJobData extends BaseJobData {
  itemId: string;
  itemIndex: number;
  binId: string;
  lockId?: string;
}

interface TimeoutJobData extends BaseJobData {
  itemId: string;
  expectedState: ItemState;
  timeout: number;
}

// Service interfaces
interface IMqttService {
  connect(): Promise<void>;
  disconnect(): void;
  publish<T>(topic: string, payload: T): void;
  subscribe(topic: string, handler: (payload: any) => void): void;
  getProcessingState(): { isProcessingItem: boolean; isNextRequestItem: boolean; isCloseWarningPopup: boolean };
}

interface IQueueService {
  add<T>(jobName: string, data: T, options?: { delay?: number; attempts?: number }): Promise<void>;
  process<T>(jobName: string, handler: (job: { data: T }) => Promise<void>): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

interface IDatabaseService {
  // Process operations
  createProcess(processId: string, data: ProcessData): Promise<ProcessStateModel>;
  getProcess(processId: string): Promise<ProcessStateModel | null>;
  updateProcessState(processId: string, newState: ProcessState, checkpoint?: Record<string, any>): Promise<ProcessStateModel>;
  getUnfinishedProcesses(): Promise<ProcessStateModel[]>;

  // Item operations
  createItemState(itemId: string, processId: string, itemIndex: number, itemData: ItemData): Promise<ItemStateModel>;
  getItemState(itemId: string): Promise<ItemStateModel | null>;
  updateItemState(itemId: string, newState: ItemState, data?: Partial<ItemStateModel>): Promise<ItemStateModel>;

  // Bin operations
  getBinById(binId: string): Promise<Bin | null>;
  updateBinStatus(binId: string, updates: Partial<Bin>): Promise<Bin>;
}

interface ILockService {
  openLock(deviceId: string, lockIds: string | string[]): Promise<{ success: boolean; results: any[]; error?: string }>;
}

// State machine configuration
type StateTransitions<TState, TEvent> = {
  [state in TState]: Partial<Record<TEvent, TState>>;
};

type StateHandlers<TState> = {
  [state in TState]?: (entityId: string, data: any) => Promise<void>;
};

// ===== INTERFACES =====

interface IStateMachine {
  transition<TState, TEvent>(entityType: 'process' | 'item', entityId: string, event: TEvent, data?: any): Promise<TState>;
}

// ===== CORE STATE MACHINE =====

class StateMachine implements IStateMachine {
  private processTransitions: StateTransitions<ProcessState, ProcessEvent>;
  private itemTransitions: StateTransitions<ItemState, ItemEvent>;
  private processHandlers: StateHandlers<ProcessState>;
  private itemHandlers: StateHandlers<ItemState>;

  constructor(
    private db: IDatabaseService,
    private queue: IQueueService,
    private mqtt: IMqttService,
    private lockService: ILockService,
  ) {
    this.processTransitions = this.defineProcessTransitions();
    this.itemTransitions = this.defineItemTransitions();
    this.processHandlers = this.defineProcessHandlers();
    this.itemHandlers = this.defineItemHandlers();
  }

  private defineProcessTransitions(): StateTransitions<ProcessState, ProcessEvent> {
    return {
      [ProcessState.CREATED]: {
        [ProcessEvent.START]: ProcessState.PROCESSING,
      },
      [ProcessState.PROCESSING]: {
        [ProcessEvent.COMPLETE]: ProcessState.COMPLETED,
        [ProcessEvent.FAIL]: ProcessState.FAILED,
        [ProcessEvent.RETRY]: ProcessState.RETRYING,
      },
      [ProcessState.RETRYING]: {
        [ProcessEvent.START]: ProcessState.PROCESSING,
        [ProcessEvent.FAIL]: ProcessState.FAILED,
      },
      [ProcessState.FAILED]: {
        [ProcessEvent.RESTART]: ProcessState.PROCESSING,
      },
      [ProcessState.COMPLETED]: {},
    };
  }

  private defineItemTransitions(): StateTransitions<ItemState, ItemEvent> {
    return {
      [ItemState.PENDING]: {
        [ItemEvent.START_BIN_OPEN]: ItemState.BIN_OPENING,
      },
      [ItemState.BIN_OPENING]: {
        [ItemEvent.BIN_OPENED]: ItemState.LOCK_OPENING,
        [ItemEvent.BIN_FAILED]: ItemState.FAILED,
      },
      [ItemState.LOCK_OPENING]: {
        [ItemEvent.LOCK_OPENED]: ItemState.PROCESSING,
        [ItemEvent.LOCK_FAILED]: ItemState.FAILED,
      },
      [ItemState.PROCESSING]: {
        [ItemEvent.PROCESSING_DONE]: ItemState.CLOSING,
        [ItemEvent.PROCESSING_FAILED]: ItemState.FAILED,
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

  async transition<TState>(
    entityType: 'process' | 'item',
    entityId: string,
    event: ProcessEvent | ItemEvent,
    data: any = {},
  ): Promise<TState> {
    const currentState = await this.getCurrentState(entityType, entityId);
    const newState = this.getNextState(entityType, currentState, event);

    if (!newState) {
      throw new Error(`Invalid transition: ${entityType}:${entityId} ${currentState} + ${event}`);
    }

    // Update state in database
    await this.updateState(entityType, entityId, newState, data);

    // Execute side effects
    await this.executeHandler(entityType, newState, entityId, data);

    return newState as TState;
  }

  private async getCurrentState(entityType: 'process' | 'item', entityId: string): Promise<ProcessState | ItemState> {
    if (entityType === 'process') {
      const process = await this.db.getProcess(entityId);
      return process?.state || ProcessState.CREATED;
    } else {
      const item = await this.db.getItemState(entityId);
      return item?.state || ItemState.PENDING;
    }
  }

  private getNextState(
    entityType: 'process' | 'item',
    currentState: ProcessState | ItemState,
    event: ProcessEvent | ItemEvent,
  ): ProcessState | ItemState | null {
    const transitions = entityType === 'process' ? this.processTransitions : this.itemTransitions;
    return (transitions as any)[currentState]?.[event] || null;
  }

  private async updateState(
    entityType: 'process' | 'item',
    entityId: string,
    newState: ProcessState | ItemState,
    data: any,
  ): Promise<void> {
    if (entityType === 'process') {
      await this.db.updateProcessState(entityId, newState as ProcessState, data);
    } else {
      await this.db.updateItemState(entityId, newState as ItemState, data);
    }
  }

  private async executeHandler(
    entityType: 'process' | 'item',
    state: ProcessState | ItemState,
    entityId: string,
    data: any,
  ): Promise<void> {
    const handlers = entityType === 'process' ? this.processHandlers : this.itemHandlers;
    const handler = (handlers as any)[state];

    if (handler) {
      await handler(entityId, data);
    }
  }

  private defineProcessHandlers(): StateHandlers<ProcessState> {
    return {
      [ProcessState.PROCESSING]: this.handleProcessStart.bind(this),
      [ProcessState.COMPLETED]: this.handleProcessComplete.bind(this),
      [ProcessState.FAILED]: this.handleProcessFailed.bind(this),
    };
  }

  private defineItemHandlers(): StateHandlers<ItemState> {
    return {
      [ItemState.BIN_OPENING]: this.handleBinOpening.bind(this),
      [ItemState.LOCK_OPENING]: this.handleLockOpening.bind(this),
      [ItemState.PROCESSING]: this.handleItemProcessing.bind(this),
      [ItemState.CLOSING]: this.handleItemClosing.bind(this),
      [ItemState.COMPLETED]: this.handleItemCompleted.bind(this),
      [ItemState.FAILED]: this.handleItemFailed.bind(this),
    };
  }

  // Handler implementations
  private async handleProcessStart(processId: string, data: any): Promise<void> {
    await this.queue.add('process.next_item', {
      processId,
      itemIndex: 0,
      timestamp: new Date(),
    });
  }

  private async handleProcessComplete(processId: string, data: any): Promise<void> {
    console.log(`Process ${processId} completed successfully`);
    // Add cleanup logic, notifications, etc.
  }

  private async handleProcessFailed(processId: string, data: any): Promise<void> {
    console.error(`Process ${processId} failed:`, data.error);
    // Add error handling, notifications, etc.
  }

  private async handleBinOpening(itemId: string, data: ItemJobData): Promise<void> {
    const binOpenMessage: BinOpenMessage = {
      itemId,
      binId: data.binId,
      deviceType: 'CU',
      deviceId: data.binId, // Assuming binId is deviceId
      lockId: data.lockId || '',
      user: data.user || ({} as User),
      type: data.type || '',
      data: data.stepData || ({} as ItemData),
      transId: data.processId,
      is_final: false,
    };

    this.mqtt.publish('bin/open', binOpenMessage);

    // Set timeout for bin open response
    await this.queue.add(
      'item.bin_open_timeout',
      {
        processId: data.processId,
        itemId,
        expectedState: ItemState.BIN_OPENING,
        timeout: 30000,
        timestamp: new Date(),
      },
      { delay: 30000 },
    );
  }

  private async handleLockOpening(itemId: string, data: ItemJobData): Promise<void> {
    const bin = await this.db.getBinById(data.binId);
    if (!bin) {
      throw new Error(`Bin not found: ${data.binId}`);
    }

    const lockResult = await this.lockService.openLock(bin.cu_id, bin.lock_id);

    if (lockResult.success && lockResult.results.length > 0) {
      await this.db.updateBinStatus(data.binId, {
        is_locked: false,
        count_failed: 0,
      });

      await this.transition('item', itemId, ItemEvent.LOCK_OPENED, data);
    } else {
      await this.db.updateBinStatus(data.binId, {
        count_failed: (bin.count_failed || 0) + 1,
      });

      await this.transition('item', itemId, ItemEvent.LOCK_FAILED, {
        error: lockResult.error || 'Lock failed to open',
      });
    }
  }

  private async handleItemProcessing(itemId: string, data: ItemJobData): Promise<void> {
    // Publish success to MQTT
    this.mqtt.publish('lock/openSuccess', {
      itemId,
      processId: data.processId,
      ...data,
    });

    // Wait for processing completion
    await this.queue.add(
      'item.wait_processing',
      {
        processId: data.processId,
        itemId,
        timeout: 60000,
        timestamp: new Date(),
      },
      { delay: 2000 },
    );
  }

  private async handleItemClosing(itemId: string, data: ItemJobData): Promise<void> {
    // Close bin and lock
    this.mqtt.publish('bin/close', {
      itemId,
      processId: data.processId,
      ...data,
    });

    // Update bin to locked state
    await this.db.updateBinStatus(data.binId, {
      is_locked: true,
    });

    await this.transition('item', itemId, ItemEvent.CLOSED, data);
  }

  private async handleItemCompleted(itemId: string, data: ItemJobData): Promise<void> {
    console.log(`Item ${itemId} completed successfully`);

    // Move to next item or complete process
    const item = await this.db.getItemState(itemId);
    if (!item) return;

    const process = await this.db.getProcess(item.processId);
    if (!process) return;

    const nextItemIndex = item.itemIndex + 1;

    if (nextItemIndex >= process.totalItems) {
      // All items completed
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

  private async handleItemFailed(itemId: string, data: any): Promise<void> {
    const item = await this.db.getItemState(itemId);
    if (!item) return;

    const maxRetries = 3;

    if (item.retryCount < maxRetries) {
      // Retry item
      await this.db.updateItemState(itemId, ItemState.FAILED, {
        retryCount: item.retryCount + 1,
      });

      await this.queue.add(
        'item.retry',
        {
          processId: item.processId,
          itemId,
          timestamp: new Date(),
        },
        { delay: 5000 },
      );
    } else {
      // Skip item and continue
      console.error(`Item ${itemId} failed after ${maxRetries} retries, skipping...`);
      await this.transition('item', itemId, ItemEvent.SKIP);
    }
  }
}

// ===== QUEUE PROCESSOR =====

class QueueProcessor {
  constructor(
    private stateMachine: StateMachine,
    private mqtt: IMqttService,
    private queue: IQueueService,
    private db: IDatabaseService,
  ) {
    this.setupJobHandlers();
    this.setupMqttHandlers();
  }

  private setupJobHandlers(): void {
    // Process level jobs
    this.queue.process<ProcessStartJobData>('process.start', this.handleProcessStart.bind(this));
    this.queue.process<BaseJobData & { itemIndex: number }>('process.next_item', this.handleNextItem.bind(this));

    // Item level jobs
    // trigger loadcells calculate
    this.queue.process<ItemJobData>('item.open_bin', this.handleOpenBin.bind(this)); // trigger loadcell calculate, pls rename it to known what exact it do.
    // open bin (cu-lock).
    this.queue.process<ItemJobData>('item.open_lock', this.handleOpenLock.bind(this));
    this.queue.process<TimeoutJobData>('item.wait_processing', this.handleWaitProcessing.bind(this));
    this.queue.process<ItemJobData>('item.close_bin', this.handleCloseBin.bind(this));
    this.queue.process<ItemJobData>('item.retry', this.handleRetryItem.bind(this));

    // Timeout jobs
    this.queue.process<TimeoutJobData>('item.bin_open_timeout', this.handleTimeout.bind(this));
    this.queue.process<TimeoutJobData>('item.processing_timeout', this.handleTimeout.bind(this));
  }

  private setupMqttHandlers(): void {
    // Convert MQTT events to queue jobs
    this.mqtt.subscribe('bin/openSuccess', (data: any) => {
      this.queue.add('item.bin_opened', {
        ...data,
        timestamp: new Date(),
      });
    });

    this.mqtt.subscribe('bin/openFail', (data: any) => {
      this.queue.add('item.bin_failed', {
        ...data,
        timestamp: new Date(),
      });
    });

    this.mqtt.subscribe('lock/openSuccess', (data: any) => {
      this.queue.add('item.lock_opened', {
        ...data,
        timestamp: new Date(),
      });
    });

    this.mqtt.subscribe('process-item/status', (data: any) => {
      if (!data.isProcessingItem) {
        this.queue.add('item.processing_completed', {
          ...data,
          timestamp: new Date(),
        });
      }
    });
  }

  // Job handlers
  private async handleProcessStart(job: { data: ProcessStartJobData }): Promise<void> {
    const { processId, type, user, items, requestQty, uniqueId } = job.data;

    // Initialize process state
    await this.stateMachine.transition('process', processId, ProcessEvent.START, {
      type,
      user,
      items,
      requestQty,
      uniqueId,
    });
  }

  private async handleNextItem(job: { data: BaseJobData & { itemIndex: number } }): Promise<void> {
    const { processId, itemIndex } = job.data;
    const process = await this.db.getProcess(processId);

    if (!process || itemIndex >= process.totalItems) {
      // All items completed
      await this.stateMachine.transition('process', processId, ProcessEvent.COMPLETE);
      return;
    }

    const item = process.data.items[itemIndex];
    const itemId = `${processId}_${itemIndex}`;

    // Initialize item state
    await this.db.createItemState(itemId, processId, itemIndex, item);

    // Start item processing
    await this.queue.add('item.open_bin', {
      processId,
      itemId,
      itemIndex,
      binId: item.bin.id,
      lockId: item.bin.lock_id,
      timestamp: new Date(),
    });
  }

  private async handleOpenBin(job: { data: ItemJobData }): Promise<void> {
    const { itemId } = job.data;
    await this.stateMachine.transition('item', itemId, ItemEvent.START_BIN_OPEN, job.data);
  }

  private async handleOpenLock(job: { data: ItemJobData }): Promise<void> {
    const { itemId } = job.data;
    await this.stateMachine.transition('item', itemId, ItemEvent.LOCK_OPENED, job.data);
  }

  private async handleWaitProcessing(job: { data: TimeoutJobData }): Promise<void> {
    const { itemId, timeout } = job.data;
    const item = await this.db.getItemState(itemId);

    if (!item) return;

    // Check if still processing
    const mqttState = this.mqtt.getProcessingState();

    if (!mqttState.isProcessingItem) {
      // Processing completed
      await this.stateMachine.transition('item', itemId, ItemEvent.PROCESSING_DONE, job.data);
      await this.queue.add('item.close_bin', {
        processId: job.data.processId,
        itemId,
        itemIndex: item.itemIndex,
        binId: item.binId,
        timestamp: new Date(),
      });
    } else if (Date.now() - item.updatedAt.getTime() > timeout) {
      // Timeout
      await this.stateMachine.transition('item', itemId, ItemEvent.PROCESSING_FAILED, {
        error: 'Processing timeout',
      });
    } else {
      // Continue waiting
      await this.queue.add('item.wait_processing', job.data, { delay: 1000 });
    }
  }

  private async handleCloseBin(job: { data: ItemJobData }): Promise<void> {
    const { itemId } = job.data;
    await this.stateMachine.transition('item', itemId, ItemEvent.CLOSED, job.data);
  }

  private async handleRetryItem(job: { data: ItemJobData }): Promise<void> {
    const { itemId } = job.data;
    await this.stateMachine.transition('item', itemId, ItemEvent.RETRY, job.data);

    // Restart item processing
    await this.queue.add('item.open_bin', job.data);
  }

  private async handleTimeout(job: { data: TimeoutJobData }): Promise<void> {
    const { itemId, expectedState } = job.data;
    const item = await this.db.getItemState(itemId);

    if (item && item.state === expectedState) {
      // Still in expected state after timeout - consider it failed
      await this.stateMachine.transition('item', itemId, ItemEvent.PROCESSING_FAILED, {
        error: `Timeout in state ${expectedState}`,
      });
    }
  }
}

// ===== DATABASE SERVICE IMPLEMENTATION =====

class DatabaseService implements IDatabaseService {
  async createProcess(processId: string, data: ProcessData): Promise<ProcessStateModel> {
    // Implementation would depend on your ORM (Sequelize, TypeORM, etc.)
    throw new Error('Method not implemented - depends on your ORM choice');
  }

  async getProcess(processId: string): Promise<ProcessStateModel | null> {
    throw new Error('Method not implemented - depends on your ORM choice');
  }

  async updateProcessState(processId: string, newState: ProcessState, checkpoint?: Record<string, any>): Promise<ProcessStateModel> {
    throw new Error('Method not implemented - depends on your ORM choice');
  }

  async getUnfinishedProcesses(): Promise<ProcessStateModel[]> {
    throw new Error('Method not implemented - depends on your ORM choice');
  }

  async createItemState(itemId: string, processId: string, itemIndex: number, itemData: ItemData): Promise<ItemStateModel> {
    throw new Error('Method not implemented - depends on your ORM choice');
  }

  async getItemState(itemId: string): Promise<ItemStateModel | null> {
    throw new Error('Method not implemented - depends on your ORM choice');
  }

  async updateItemState(itemId: string, newState: ItemState, data?: Partial<ItemStateModel>): Promise<ItemStateModel> {
    throw new Error('Method not implemented - depends on your ORM choice');
  }

  async getBinById(binId: string): Promise<Bin | null> {
    throw new Error('Method not implemented - depends on your ORM choice');
  }

  async updateBinStatus(binId: string, updates: Partial<Bin>): Promise<Bin> {
    throw new Error('Method not implemented - depends on your ORM choice');
  }
}

// ===== RECOVERY SERVICE =====

class RecoveryService {
  constructor(
    private stateMachine: StateMachine,
    private queue: IQueueService,
    private db: IDatabaseService,
  ) {}

  async recoverOnStartup(): Promise<void> {
    const unfinishedProcesses = await this.db.getUnfinishedProcesses();

    console.log(`Found ${unfinishedProcesses.length} unfinished processes to recover`);

    for (const process of unfinishedProcesses) {
      await this.recoverProcess(process.id);
    }
  }

  private async recoverProcess(processId: string): Promise<void> {
    const process = await this.db.getProcess(processId);
    if (!process) return;

    switch (process.state) {
      case ProcessState.PROCESSING:
        // Resume from current item
        await this.queue.add('process.next_item', {
          processId,
          itemIndex: process.currentItemIndex,
          timestamp: new Date(),
        });
        break;

      case ProcessState.RETRYING:
        // Retry the failed operation
        await this.retryFailedOperation(processId, process.checkpoints);
        break;
    }
  }

  private async retryFailedOperation(processId: string, checkpoints: Record<string, any>): Promise<void> {
    const lastFailedStep = checkpoints.lastFailedStep;
    const lastJobData = checkpoints.lastJobData;

    switch (lastFailedStep) {
      case 'BIN_OPENING':
        await this.queue.add('item.open_bin', {
          ...lastJobData,
          timestamp: new Date(),
        });
        break;
      case 'LOCK_OPENING':
        await this.queue.add('item.open_lock', {
          ...lastJobData,
          timestamp: new Date(),
        });
        break;
      default:
        console.warn(`Unknown failed step: ${lastFailedStep}`);
    }
  }
}

// ===== MAIN APPLICATION =====

interface SystemConfig {
  mqtt: {
    url: string;
    options?: any;
  };
  queue: {
    redis: {
      host: string;
      port: number;
      password?: string;
    };
  };
  database: {
    // Your database config
  };
}

class ItemProcessingSystem {
  private stateMachine: StateMachine;
  private queueProcessor: QueueProcessor;
  private recoveryService: RecoveryService;

  constructor(
    private config: SystemConfig,
    private db: IDatabaseService,
    private mqtt: IMqttService,
    private queue: IQueueService,
    private lockService: ILockService,
  ) {
    this.stateMachine = new StateMachine(db, queue, mqtt, lockService);
    this.queueProcessor = new QueueProcessor(this.stateMachine, mqtt, queue, db);
    this.recoveryService = new RecoveryService(this.stateMachine, queue, db);
  }

  async initialize(): Promise<void> {
    // Connect to external services
    await this.mqtt.connect();
    await this.queue.connect();

    // Recover unfinished processes
    await this.recoveryService.recoverOnStartup();

    console.log('Item Processing System initialized successfully');
  }

  async startProcess(data: ProcessData): Promise<string> {
    const processId = this.generateProcessId();

    await this.db.createProcess(processId, data);

    await this.queue.add<ProcessStartJobData>('process.start', {
      processId,
      timestamp: new Date(),
      ...data,
    });

    return processId;
  }

  async getProcessStatus(processId: string): Promise<ProcessStateModel | null> {
    return await this.db.getProcess(processId);
  }

  async retryProcess(processId: string): Promise<void> {
    await this.stateMachine.transition('process', processId, ProcessEvent.RESTART);
  }

  async skipFailedItem(itemId: string): Promise<void> {
    await this.stateMachine.transition('item', itemId, ItemEvent.SKIP);
  }

  private generateProcessId(): string {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown(): Promise<void> {
    await this.queue.disconnect();
    this.mqtt.disconnect();
    console.log('System shutdown completed');
  }
}

// ===== FACTORY FUNCTION =====

export async function createItemProcessingSystem(config: SystemConfig): Promise<ItemProcessingSystem> {
  // These would be actual implementations based on your tech stack
  const db = new DatabaseService();
  const mqtt = {} as IMqttService; // Your MQTT service implementation
  const queue = {} as IQueueService; // Your Queue service implementation (Bull, etc.)
  const lockService = {} as ILockService; // Your Lock service implementation

  const system = new ItemProcessingSystem(config, db, mqtt, queue, lockService);
  await system.initialize();

  return system;
}

// ===== USAGE EXAMPLE =====

/*
const config: SystemConfig = {
  mqtt: {
    url: 'mqtt://localhost:1883'
  },
  queue: {
    redis: {
      host: 'localhost',
      port: 6379
    }
  },
  database: {
    // Your database config
  }
};

const system = await createItemProcessingSystem(config);

// Start a new process
const processId = await system.startProcess({
  type: 'issue',
  user: {
    id: 'user123',
    user_cloud_id: 'cloud456',
    userLogin: 'john.doe',
    userRole: 'operator'
  },
  items: [
    {
      id: 'item1',
      type: 'consumable',
      bin: {
        id: 'bin1',
        name: 'Bin A1',
        row: '1',
        cu_id: 'cu001',
        lock_id: 'lock001',
        is_locked: true,
        is_failed: false,
        count_failed: 0
      },
      cabinet: {
        id: 'cab1',
        name: 'Cabinet 1'
      },
      changed_qty: 5
    }
  ],
  requestQty: 5,
  uniqueId: 'tablet001'
});

console.log('Started process:', processId);

// Monitor progress
const status = await system.getProcessStatus(processId);
console.log('Process status:', status?.state);

// Manual intervention if needed
if (status?.state === ProcessState.FAILED) {
  await system.retryProcess(processId);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await system.shutdown();
  process.exit(0);
});
*/

export {
  ProcessState,
  ItemState,
  ProcessEvent,
  ItemEvent,
  StateMachine,
  QueueProcessor,
  RecoveryService,
  ItemProcessingSystem,
  type ProcessData,
  type ItemData,
  type User,
  type SystemConfig,
};
