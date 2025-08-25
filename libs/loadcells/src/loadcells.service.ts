import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { InjectSerialManager, ISerialAdapter } from '@serialport/serial';
import { Observable, Subject, BehaviorSubject, timer, EMPTY, from, of, Subscription, forkJoin } from 'rxjs';
import { map, takeUntil, catchError, switchMap, concatMap, repeat, delay } from 'rxjs/operators';

import { ALL_MESSAGES, LOADCELLS_SERVICE_CONFIG } from './loadcells.contants';
import { LoadCellConfig, LoadCellDevice, LoadCellHooks, LoadCellReading } from './loadcells.types';

@Injectable()
export class LoadcellsService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(LoadcellsService.name);
  private readonly _destroy$ = new Subject<void>();
  private _pollingSubscription: Subscription | null = null;

  // --- State Management ---
  private readonly _isRunning$ = new BehaviorSubject<boolean>(false);
  private readonly _onlineDevices$ = new BehaviorSubject<number[]>([]);
  private readonly _activeMessages$ = new BehaviorSubject<LoadCellDevice[]>([]);
  private _activeDeviceIds = new Set<number>();

  // --- Hooks Registry ---
  private readonly _hooks = new Map<string, LoadCellHooks>();
  private _globalHooks: LoadCellHooks = {};

  // --- Internal State ---
  private _connectedPorts: string[] = [];
  private _portStates = new Map<string, 'connecting' | 'connected' | 'disconnecting' | 'disconnected'>();
  private _reconnectAttempts = new Map<string, number>();
  private _callbackUnsubscribers = new Map<string, (() => void)[]>();

  private readonly _allDiscoveryMessages: LoadCellDevice[] = ALL_MESSAGES;
  private readonly _deviceMessageMap = new Map<number, LoadCellDevice>();

  constructor(
    @Inject(LOADCELLS_SERVICE_CONFIG) private readonly _config: LoadCellConfig,
    @InjectSerialManager() private readonly _serialAdapter: ISerialAdapter,
  ) {
    this._allDiscoveryMessages.forEach((msg) => {
      const buffer = this._bufferFromBufferString(msg.data);
      const deviceId = buffer[0];
      this._deviceMessageMap.set(deviceId, msg);
    });
  }

  public onModuleInit(): void {
    this._logger.log('Initializing Hardwired LoadCell Service');
  }

  public async onModuleDestroy(): Promise<void> {
    this._logger.log('Shutting down Hardwired LoadCell Service');
    await this.stop();
    this._destroy$.next();
    this._destroy$.complete();
  }

  public async start(ports: string[]): Promise<void> {
    if (this._isRunning$.value) {
      this._logger.warn('Service is already running');
      return;
    }
    this._connectedPorts = ports;
    if (ports.length === 0) {
      throw new Error('No ports provided for monitoring');
    }

    this._logger.log(`Starting monitoring on ports: ${ports.join(', ')}`);
    await this._connectToPorts();
    this._isRunning$.next(true);
    this._callStatusChangeHooks(true);
    this._runDiscoveryCycle();
  }

  public async stop(): Promise<void> {
    if (!this._isRunning$.value) {
      return;
    }
    this._logger.log('Stopping loadcells service');
    this._stopDataPolling();
    await this._disconnectFromPorts();
    this._isRunning$.next(false);
    this._connectedPorts = [];
    this._onlineDevices$.next([]);
    this._activeMessages$.next([]);
    this._activeDeviceIds.clear();
    this._callStatusChangeHooks(false);
  }

  public addActiveDevices(deviceIds: number[]): void {
    let isChanged = false;
    const onlineDevices = this._onlineDevices$.value;
    deviceIds.forEach((id) => {
      if (!onlineDevices.includes(id)) {
        this._logger.warn(`Attempted to add device ${id}, but it was not found during discovery. Skipping.`);
        return;
      }
      if (!this._activeDeviceIds.has(id)) {
        this._activeDeviceIds.add(id);
        isChanged = true;
      }
    });
    if (isChanged) {
      this._logger.log(`Adding devices. New active set: [${Array.from(this._activeDeviceIds).join(', ')}]`);
      this._updateAndRestartPolling();
    }
  }

  public removeActiveDevices(deviceIds: number[]): void {
    let isChanged = false;
    deviceIds.forEach((id) => {
      if (this._activeDeviceIds.has(id)) {
        this._activeDeviceIds.delete(id);
        isChanged = true;
      }
    });
    if (isChanged) {
      this._logger.log(`Removing devices. New active set: [${Array.from(this._activeDeviceIds).join(', ')}]`);
      this._updateAndRestartPolling();
    }
  }

  /**
   * Set active loadcells , previous active loadcell will be remove
   * @param {number[]} deviceIds
   */
  public setActiveDevices(deviceIds: number[]): void {
    const onlineDevices = this._onlineDevices$.value;
    const validDeviceIds = deviceIds.filter((id) => {
      const isValid = onlineDevices.includes(id);
      if (!isValid) {
        this._logger.warn(`Device ${id} in setActiveDevices list was not found during discovery. It will be ignored.`);
      }
      return isValid;
    });
    this._logger.log(`Setting active devices to: [${validDeviceIds.join(', ')}].`);
    this._activeDeviceIds = new Set(validDeviceIds);
    this._updateAndRestartPolling();
  }

  // --- Getters for State Observables ---
  public get onlineDevices$(): Observable<number[]> {
    return this._onlineDevices$.pipe(takeUntil(this._destroy$));
  }
  public get isRunning$(): Observable<boolean> {
    return this._isRunning$.pipe(takeUntil(this._destroy$));
  }

  // --- Hooks Management ---
  public registerGlobalHooks(hooks: LoadCellHooks): void {
    this._globalHooks = { ...this._globalHooks, ...hooks };
  }
  public registerHooks(contextId: string, hooks: LoadCellHooks): void {
    this._hooks.set(contextId, hooks);
  }
  public unregisterHooks(contextId: string): void {
    this._hooks.delete(contextId);
  }
  public clearAllHooks(): void {
    this._hooks.clear();
    this._globalHooks = {};
  }

  // --- Core Logic ---
  private _updateAndRestartPolling(): void {
    const newActiveMessages: LoadCellDevice[] = [];
    this._activeDeviceIds.forEach((id) => {
      const messageData = this._deviceMessageMap.get(id);
      if (messageData) {
        newActiveMessages.push(messageData);
      }
    });
    this._activeMessages$.next(newActiveMessages);
    this._stopDataPolling();
    if (this._activeDeviceIds.size > 0) {
      this._startDataPolling();
    } else {
      this._logger.log('No active devices left. Polling stopped.');
    }
  }

  private _startDataPolling(): void {
    if (this._pollingSubscription) {
      return;
    }
    const messagesToPoll = this._activeMessages$.value;
    if (messagesToPoll.length === 0) {
      return;
    }
    this._logger.log(`Starting continuous polling for ${messagesToPoll.length} devices.`);
    this._pollingSubscription = this._createPollingObservable(messagesToPoll).subscribe({
      error: (err) => this._logger.error('Polling loop encountered a fatal error.', err),
    });
  }

  private _stopDataPolling(): void {
    if (this._pollingSubscription) {
      this._pollingSubscription.unsubscribe();
      this._pollingSubscription = null;
      this._logger.log('Data polling stopped.');
    }
  }

  private _createPollingObservable(messages: LoadCellDevice[]): Observable<any> {
    return from(messages).pipe(
      concatMap((message, index) =>
        of(message).pipe(
          delay(index === 0 ? this._config.pollingInterval : this._config.initTimer),
          switchMap((msg) => this._sendMessage(msg)),
        ),
      ),
      repeat(),
      takeUntil(this._destroy$),
    );
  }

  private _runDiscoveryCycle(): void {
    this._logger.log('Starting one-time device discovery cycle...');
    this._onlineDevices$.next([]);
    const discoveryObservable = from(this._allDiscoveryMessages).pipe(
      concatMap((message, index) => timer(index * this._config.initTimer).pipe(switchMap(() => this._sendMessage(message)))),
      takeUntil(this._destroy$),
    );
    discoveryObservable.subscribe({
      complete: () => {
        this._logger.log(
          `Discovery phase ended. Found ${this._onlineDevices$.value.length} online devices: [${this._onlineDevices$.value.join(', ')}]`,
        );
      },
      error: (error) => this._logger.error('An error occurred during the discovery cycle.', error),
    });
  }

  private _processReading(reading: LoadCellReading): void {
    if (this._config.logLevel > 0) {
      this._logger.debug(`Device ${reading.rawDeviceId}: ${reading.weight}kg [${reading.status}]`);
    }
    const isAlreadyOnline = this._onlineDevices$.value.includes(reading.rawDeviceId);
    if (!isAlreadyOnline && reading.status === 'running') {
      const newOnline = [...this._onlineDevices$.value, reading.rawDeviceId];
      this._onlineDevices$.next(newOnline);
      this._callDeviceDiscoveryHooks(reading.rawDeviceId, true);
      this._logger.log(`Device ${reading.rawDeviceId} discovered (${newOnline.length} total)`);
    }
    this._callDataHooks(reading);
  }

  private async _connectToPorts(): Promise<void> {
    const connectionPromises = this._connectedPorts.map(async (port) => this._connectToSinglePort(port));
    await Promise.allSettled(connectionPromises);
  }

  private async _connectToSinglePort(port: string): Promise<void> {
    if (this._portStates.get(port) === 'connecting') {
      return;
    }
    this._portStates.set(port, 'connecting');
    this._logger.log(`Connecting to port: ${port}`);
    try {
      const currentState = await this._serialAdapter.getConnectionState(port);
      if (currentState.isOpen) {
        await this._serialAdapter.close(port);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      this._logger.debug(`Port ${port} close check error:`, error.message);
    }
    try {
      const state = await this._serialAdapter.open(port, this._config.serialOptions);
      if (!state.isOpen) {
        throw new Error(`Failed to open port ${port}: ${state.lastError || 'Unknown error'}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      const verifyState = await this._serialAdapter.getConnectionState(port);
      if (!verifyState.isOpen) {
        throw new Error(`Port ${port} closed unexpectedly after opening`);
      }
      await this._setupPortCallbacks(port);
      this._portStates.set(port, 'connected');
      this._reconnectAttempts.set(port, 0);
      this._logger.log(`Port ${port} setup completed successfully`);
    } catch (error) {
      this._portStates.set(port, 'disconnected');
      this._logger.error(`Failed to connect to port ${port}:`, error);
      throw error;
    }
  }

  private async _setupPortCallbacks(port: string): Promise<void> {
    const comId = this._extractComId(port);
    const dataCallback = (data: Buffer) => {
      try {
        const reading = this._parseRawData(port, data, comId);
        if (reading) {
          this._processReading(reading);
        }
      } catch (error) {
        this._logger.error(`Data callback error for ${port}:`, error);
      }
    };
    const errorCallback = (error: Error) => {
      this._logger.error(`Serial error on ${port}:`, error);
      this._callErrorHooks(error, `Serial port ${port}`);
      if (this._isCriticalError(error)) {
        this._handleCriticalPortError(port, error);
      }
    };
    try {
      const unsubData = this._serialAdapter.onDataStream(port, dataCallback);
      let unsubError: () => void = () => {};
      if (typeof this._serialAdapter.onErrorStream === 'function') {
        unsubError = this._serialAdapter.onErrorStream(port, errorCallback);
      }
      this._callbackUnsubscribers.set(port, [unsubData, unsubError].filter(Boolean));
    } catch (error) {
      this._logger.error(`Failed to setup callbacks for ${port}:`, error);
      throw error;
    }
  }

  private _sendMessage(message: LoadCellDevice): Observable<void> {
    if (this._connectedPorts.length === 0) {
      return EMPTY;
    }
    const buffer = this._bufferFromBufferString(message.data);
    const sendOps = this._connectedPorts.map((port) =>
      from(this._serialAdapter.write(port, buffer)).pipe(
        catchError((error) => {
          this._logger.error(`Failed to send to ${port}:`, error);
          return of(false);
        }),
      ),
    );
    return from(forkJoin(sendOps)).pipe(map(() => void 0));
  }

  private _parseRawData(port: string, buffer: Buffer, comId: number): LoadCellReading | null {
    const rawPayload = Array.from(buffer);
    if (!this._validateRawData(rawPayload)) {
      return null;
    }
    const rawDeviceId = rawPayload[1];
    if (rawDeviceId === 1) {
      rawPayload[2] = 0x3d;
    }
    if (this._crc16Validation(rawPayload.slice(1)) !== 0) {
      this._logger.warn(`CRC validation failed for device ${rawDeviceId}`);
      return {
        path: port,
        deviceId: comId * 100 + rawDeviceId,
        rawDeviceId,
        weight: 0,
        status: 'error',
        timestamp: new Date(),
        rawData: rawPayload,
      };
    }
    const value = (rawPayload[8] << 24) | (rawPayload[7] << 16) | (rawPayload[6] << 8) | rawPayload[5];
    return {
      path: port,
      deviceId: comId * 100 + rawDeviceId,
      rawDeviceId,
      weight: value / this._config.precision,
      status: 'running',
      timestamp: new Date(),
      rawData: rawPayload,
    };
  }

  private _validateRawData(rawPayload: number[]): boolean {
    const messageAddresses = Array.from(this._deviceMessageMap.keys());
    if (!rawPayload.length || rawPayload.length < this._config.messageLength) {
      return false;
    }
    if (!messageAddresses.includes(rawPayload[1])) {
      return false;
    }
    return rawPayload[0] === this._config.charStart;
  }

  private _bufferFromBufferString(bufferStr: string): Buffer {
    return Buffer.from(
      bufferStr
        .replace(/[<>]/g, '')
        .split(' ')
        .slice(1)
        .map((val) => parseInt(val, 16)),
    );
  }

  private _crc16Validation(arr: number[]): number {
    let crc = 0xffff;
    for (const byte of arr) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = (crc & 1) !== 0 ? (crc >> 1) ^ 0xa001 : crc >> 1;
      }
    }
    return crc;
  }

  private _extractComId(portPath: string): number {
    const match = portPath.match(/(?:COM|ttyS)(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  private _isCriticalError(error: Error): boolean {
    const criticalMessages = ['ENOENT', 'EACCES', 'EBUSY', 'device disconnected', 'port not open'];
    return criticalMessages.some((msg) => error.message.toLowerCase().includes(msg.toLowerCase()));
  }

  private async _handleCriticalPortError(port: string, error: Error): Promise<void> {
    this._logger.warn(`Critical error on ${port}, attempting recovery:`, error.message);
    try {
      await this._disconnectFromSinglePort(port);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await this._connectToSinglePort(port);
    } catch (recoveryError) {
      this._logger.error(`Recovery failed for ${port}:`, recoveryError);
    }
  }

  private async _disconnectFromSinglePort(port: string): Promise<void> {
    if (this._portStates.get(port) === 'disconnecting') {
      return;
    }
    this._portStates.set(port, 'disconnecting');
    const unsubscribers = this._callbackUnsubscribers.get(port) || [];
    for (const unsub of unsubscribers) {
      try {
        unsub();
      } catch (e) {
        /* ignore */
      }
    }
    this._callbackUnsubscribers.delete(port);
    try {
      await this._serialAdapter.close(port);
    } catch (e) {
      this._logger.warn(`Failed to close port ${port} during disconnect:`, e.message);
    }
    this._portStates.set(port, 'disconnected');
  }

  private _callDataHooks(reading: LoadCellReading): void {
    if (this._globalHooks.onData) {
      this._globalHooks.onData(reading);
    }
    this._hooks.forEach((hooks) => {
      if (hooks.onData) {
        hooks.onData(reading);
      }
    });
  }

  private _callErrorHooks(error: Error, context?: string): void {
    if (this._globalHooks.onError) {
      this._globalHooks.onError(error, context);
    }
    this._hooks.forEach((hooks) => {
      if (hooks.onError) {
        hooks.onError(error, context);
      }
    });
  }

  private _callDeviceDiscoveryHooks(deviceId: number, isOnline: boolean): void {
    if (this._globalHooks.onDeviceDiscovery) {
      this._globalHooks.onDeviceDiscovery(deviceId, isOnline);
    }
    this._hooks.forEach((hooks) => {
      if (hooks.onDeviceDiscovery) {
        hooks.onDeviceDiscovery(deviceId, isOnline);
      }
    });
  }
  private _callStatusChangeHooks(isRunning: boolean): void {
    if (this._globalHooks.onStatusChange) {
      this._globalHooks.onStatusChange(isRunning);
    }
    this._hooks.forEach((hooks) => {
      if (hooks.onStatusChange) {
        hooks.onStatusChange(isRunning);
      }
    });
  }

  private async _disconnectFromPorts(): Promise<void> {
    if (this._connectedPorts.length === 0) {
      return;
    }

    this._logger.log(`Disconnecting from ${this._connectedPorts.length} ports...`);
    const disconnectionPromises = this._connectedPorts.map(async (port) => this._disconnectFromSinglePort(port));
    await Promise.allSettled(disconnectionPromises);
    this._connectedPorts = [];
    this._logger.log('All ports have been processed for disconnection.');
  }
}
