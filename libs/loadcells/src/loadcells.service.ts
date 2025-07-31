import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectSerialManager, ISerialAdapter } from '@serialport/serial';
import { Observable, Subject, BehaviorSubject, timer, EMPTY, from, forkJoin, of, interval } from 'rxjs';
import { map, takeUntil, tap, catchError, switchMap, filter, retry, mergeMap, distinctUntilChanged, debounceTime } from 'rxjs/operators';

import { ALL_MESSAGES } from './loadcells.contants';
import { LoadCellConfig, LoadCellDevice, LoadCellHooks, LoadCellReading, LoadCellStats } from './loadcells.types';

export type LoadCellPerformanceStats = {
  messagesPerSecond: number;
  errorRate: number;
  avgResponseTime: number;
  lastActivityTime: Date;
  portStatistics: Map<
    string,
    {
      messagesReceived: number;
      errors: number;
      lastMessage: Date;
    }
  >;
};

export type LoadCellConnectionHealth = {
  port: string;
  isHealthy: boolean;
  issues: string[];
  lastReading?: LoadCellReading;
  connectionDuration: number;
};

@Injectable()
export class LoadcellsService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(LoadcellsService.name);
  private readonly _destroy$ = new Subject<void>();

  // Configuration
  private readonly _config: LoadCellConfig = {
    enabled: true,
    logLevel: 0,
    precision: 100,
    initTimer: 500,
    charStart: 0x55,
    messageLength: 11,
    discoveryTimeout: 10000, // 10 seconds
    serialOptions: {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      autoOpen: true,
      maxReconnectAttempts: 5,
      retryDelay: 5000,
    },
  };

  // State management
  private readonly _isRunning$ = new BehaviorSubject<boolean>(false);
  private readonly _onlineDevices$ = new BehaviorSubject<number[]>([]);
  private readonly _currentMessages$ = new BehaviorSubject<LoadCellDevice[]>([]);
  private readonly _stats$ = new BehaviorSubject<LoadCellStats>(this._createInitialStats());
  private readonly _performanceStats$ = new BehaviorSubject<LoadCellPerformanceStats>(this._createInitialPerformanceStats());
  private readonly _connectionHealth$ = new BehaviorSubject<LoadCellConnectionHealth[]>([]);

  // Hooks registry
  private readonly _hooks = new Map<string, LoadCellHooks>();
  private _globalHooks: LoadCellHooks = {};

  // Internal state
  private _connectedPorts: string[] = [];
  private _discoveryPhase = true;
  private _readingsCount = 0;
  private _errorsCount = 0;
  private _startTime = Date.now();
  private _lastReadingTime = Date.now();
  private _portStats = new Map<string, { messagesReceived: number; errors: number; lastMessage: Date }>();

  private readonly _allMessages: LoadCellDevice[] = ALL_MESSAGES;
  private readonly _messageAddresses: number[];

  // Data stream callbacks for Promise-based adapter
  private _dataStreamCallbacks = new Map<string, (data: Buffer) => void>();

  // NEW: Track callback unsubscribe functions
  private _callbackUnsubscribers = new Map<string, (() => void)[]>();

  constructor(@InjectSerialManager() private readonly _serialAdapter: ISerialAdapter) {
    this._messageAddresses = this._allMessages.map((msg) => parseInt(this._getBufferContent(msg.data).slice(0, 2), 16));
    this._currentMessages$.next([...this._allMessages]);

    // Start performance monitoring
    this._startPerformanceMonitoring();
  }

  public onModuleInit(): void {
    this._logger.log('Initializing Hardwired LoadCell Service');
  }

  public onModuleDestroy(): void {
    this._logger.log('Shutting down Hardwired LoadCell Service');
    this.stop();
    this._destroy$.next();
    this._destroy$.complete();
  }

  public registerGlobalHooks(hooks: LoadCellHooks): void {
    this._globalHooks = { ...this._globalHooks, ...hooks };
    this._logger.log('Global hooks registered');
  }

  public registerHooks(contextId: string, hooks: LoadCellHooks): void {
    this._hooks.set(contextId, hooks);
    this._logger.log(`Hooks registered for context: ${contextId}`);
  }

  public unregisterHooks(contextId: string): void {
    this._hooks.delete(contextId);
    this._logger.log(`Hooks unregistered for context: ${contextId}`);
  }

  public clearAllHooks(): void {
    this._hooks.clear();
    this._globalHooks = {};
    this._logger.log('All hooks cleared');
  }

  public get onlineDevices$(): Observable<number[]> {
    return this._onlineDevices$.pipe(takeUntil(this._destroy$));
  }

  public get isRunning$(): Observable<boolean> {
    return this._isRunning$.pipe(takeUntil(this._destroy$));
  }

  public get currentMessages$(): Observable<LoadCellDevice[]> {
    return this._currentMessages$.pipe(takeUntil(this._destroy$));
  }

  public get stats$(): Observable<LoadCellStats> {
    return this._stats$.pipe(takeUntil(this._destroy$));
  }

  public get performanceStats$(): Observable<LoadCellPerformanceStats> {
    return this._performanceStats$.pipe(takeUntil(this._destroy$));
  }

  public get connectionHealth$(): Observable<LoadCellConnectionHealth[]> {
    return this._connectionHealth$.pipe(takeUntil(this._destroy$));
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

    // Reset statistics
    this._readingsCount = 0;
    this._errorsCount = 0;
    this._startTime = Date.now();
    this._portStats.clear();

    // Initialize port statistics
    ports.forEach((port) => {
      this._portStats.set(port, {
        messagesReceived: 0,
        errors: 0,
        lastMessage: new Date(),
      });
    });

    // NEW: Connect to ports (this will open them)
    await this._connectToPorts();
    this._scheduleDiscoveryTimeout();
    this._startConnectionHealthMonitoring();

    this._isRunning$.next(true);
    this._callStatusChangeHooks(true);
  }

  public async stop(): Promise<void> {
    if (!this._isRunning$.value) {
      return;
    }

    this._logger.log('Stopping loadcells service');

    // NEW: Clean up callbacks
    this._cleanupCallbacks();

    // NEW: Close all ports
    await this._disconnectFromPorts();

    this._isRunning$.next(false);
    this._connectedPorts = [];
    this._discoveryPhase = true;
    this._onlineDevices$.next([]);
    this._currentMessages$.next([...this._allMessages]);
    this._connectionHealth$.next([]);

    this._callStatusChangeHooks(false);
  }

  public setActiveDevices(deviceIds: number[]): void {
    const activeMessages = this._allMessages.filter((msg) => {
      const buffer = this._bufferFromBufferString(msg.data);
      return deviceIds.includes(buffer[0]);
    });

    this._currentMessages$.next(activeMessages);
    this._updateStats();
    this._logger.log(`Active devices set: ${deviceIds.join(', ')}`);
  }

  public resetToOnlineDevices(): void {
    const onlineDevices = this._onlineDevices$.value;
    this.setActiveDevices(onlineDevices);
    this._logger.log('Reset to online devices');
  }

  public getCurrentStats(): LoadCellStats {
    return this._stats$.value;
  }

  public getCurrentPerformanceStats(): LoadCellPerformanceStats {
    return this._performanceStats$.value;
  }

  public refreshStats(): void {
    this._updateStats();
    this._updatePerformanceStats();
  }

  public getPortHealth(port: string): Observable<LoadCellConnectionHealth> {
    return this._connectionHealth$.pipe(
      map((healthArray) => healthArray.find((h) => h.port === port)),
      filter(Boolean),
      takeUntil(this._destroy$),
    );
  }

  public getAllPortsHealth(): Observable<LoadCellConnectionHealth[]> {
    return this._connectionHealth$.pipe(takeUntil(this._destroy$));
  }

  // NEW: Get connection states for all ports
  public async getPortConnectionStates(): Promise<Map<string, any>> {
    const states = new Map();

    for (const port of this._connectedPorts) {
      try {
        const state = await this._serialAdapter.getConnectionState(port);
        states.set(port, state);
      } catch (error) {
        this._logger.debug(`Failed to get state for ${port}:`, error);
        states.set(port, { isOpen: false, error: error.message });
      }
    }

    return states;
  }

  // ENHANCED: Connect to ports with proper opening
  private async _connectToPorts(): Promise<void> {
    if (this._connectedPorts.length === 0) {
      return;
    }

    const connectionPromises = this._connectedPorts.map(async (port) => this._connectToSinglePort(port));

    // Connect to all ports in parallel
    const results = await Promise.allSettled(connectionPromises);

    // Log results
    results.forEach((result, index) => {
      const port = this._connectedPorts[index];
      if (result.status === 'fulfilled') {
        this._logger.log(`Successfully connected to ${port}`);
      } else {
        this._logger.error(`Failed to connect to ${port}:`, result.reason);
        // Continue with other ports even if one fails
      }
    });
  }

  // NEW: Connect to single port
  private async _connectToSinglePort(port: string): Promise<void> {
    this._logger.log(`Connecting to port: ${port}`);

    try {
      // 1. OPEN PORT FIRST
      const state = await this._serialAdapter.open(port, this._config.serialOptions);

      if (!state.isOpen) {
        throw new Error(`Failed to open port ${port}: ${state.lastError || 'Unknown error'}`);
      }

      this._logger.log(`Port ${port} opened successfully`);

      // 2. Setup data callback AFTER port is opened
      const comId = this._extractComId(port);
      const dataCallback = (data: Buffer) => {
        const reading = this._parseRawData(port, data, comId);
        if (reading) {
          this._processReading(reading);
          this._callDataHooks(reading);
          this._updateStats();
          this._updatePortStats(port, false);
        }
      };

      // Store callback reference
      this._dataStreamCallbacks.set(port, dataCallback);

      // Register data stream callback - returns unsubscribe function
      const unsubscribeData = this._serialAdapter.onDataStream(port, dataCallback);

      // 3. Setup error callback if adapter supports it
      let unsubscribeError: () => void = () => {};
      if (typeof this._serialAdapter.onErrorStream === 'function') {
        const errorCallback = (error: Error) => {
          this._errorsCount++;
          this._updatePortStats(port, true);
          this._callErrorHooks(error, `Serial port ${port}`);
          this._updateStats();
        };

        unsubscribeError = this._serialAdapter.onErrorStream(port, errorCallback);
      } else {
        // Fallback to Promise-based error handling
        from(this._serialAdapter.onError(port))
          .pipe(takeUntil(this._destroy$), retry({ count: 3, delay: 1000 }))
          .subscribe({
            next: (error) => {
              this._errorsCount++;
              this._updatePortStats(port, true);
              this._callErrorHooks(error, `Serial port ${port}`);
              this._updateStats();
            },
            error: (streamError) => {
              this._logger.error(`Error stream failed for ${port}:`, streamError);
            },
          });
      }

      // Store unsubscribe functions for cleanup
      const unsubscribers = [unsubscribeData, unsubscribeError].filter(Boolean);
      this._callbackUnsubscribers.set(port, unsubscribers);

      // 4. Start monitoring connection
      this._monitorPortConnection(port);

      this._logger.log(`Port ${port} setup completed with ${unsubscribers.length} callbacks`);
    } catch (error) {
      this._logger.error(`Failed to connect to port ${port}:`, error);
      throw error; // Re-throw to be handled by Promise.allSettled
    }
  }

  // NEW: Disconnect from all ports
  private async _disconnectFromPorts(): Promise<void> {
    if (this._connectedPorts.length === 0) {
      return;
    }

    this._logger.log(`Disconnecting from ${this._connectedPorts.length} ports`);

    const disconnectionPromises = this._connectedPorts.map(async (port) => this._disconnectFromSinglePort(port));

    // Disconnect from all ports in parallel
    const results = await Promise.allSettled(disconnectionPromises);

    // Log results
    results.forEach((result, index) => {
      const port = this._connectedPorts[index];
      if (result.status === 'fulfilled') {
        this._logger.log(`Successfully disconnected from ${port}`);
      } else {
        this._logger.error(`Failed to disconnect from ${port}:`, result.reason);
      }
    });

    // Clear port arrays
    this._connectedPorts = [];
    this._dataStreamCallbacks.clear();
    this._callbackUnsubscribers.clear();
  }

  // NEW: Disconnect from single port
  private async _disconnectFromSinglePort(port: string): Promise<void> {
    try {
      // 1. Unsubscribe callbacks first
      const unsubscribers = this._callbackUnsubscribers.get(port);
      if (unsubscribers) {
        unsubscribers.forEach((unsub) => {
          try {
            unsub();
          } catch (error) {
            this._logger.debug(`Error unsubscribing callback for ${port}:`, error);
          }
        });
        this._callbackUnsubscribers.delete(port);
      }

      // 2. Close port
      await this._serialAdapter.close(port);

      // 3. Clean up references
      this._dataStreamCallbacks.delete(port);

      this._logger.debug(`Port ${port} disconnected and cleaned up`);
    } catch (error) {
      this._logger.error(`Error disconnecting from ${port}:`, error);
      throw error;
    }
  }

  // NEW: Clean up callbacks
  private _cleanupCallbacks(): void {
    // Unsubscribe all callbacks
    this._callbackUnsubscribers.forEach((unsubscribers, port) => {
      unsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch (error) {
          this._logger.debug(`Error unsubscribing callback for ${port}:`, error);
        }
      });
    });

    this._callbackUnsubscribers.clear();
    this._dataStreamCallbacks.clear();
  }

  // NEW: Check if all ports are connected
  public async areAllPortsConnected(): Promise<boolean> {
    if (this._connectedPorts.length === 0) {
      return false;
    }

    const connectionChecks = this._connectedPorts.map(async (port) => {
      try {
        return await this._serialAdapter.isPortConnected(port);
      } catch {
        return false;
      }
    });

    const results = await Promise.all(connectionChecks);
    return results.every((connected) => connected);
  }

  // NEW: Reconnect to failed ports
  public async reconnectFailedPorts(): Promise<void> {
    const reconnectPromises = this._connectedPorts.map(async (port) => {
      try {
        const isConnected = await this._serialAdapter.isPortConnected(port);
        if (!isConnected) {
          this._logger.log(`Reconnecting to failed port: ${port}`);
          await this._connectToSinglePort(port);
        }
      } catch (error) {
        this._logger.error(`Failed to reconnect to ${port}:`, error);
      }
    });

    await Promise.all(reconnectPromises);
  }

  private _monitorPortConnection(port: string): void {
    interval(5000)
      .pipe(
        // Check every 5 seconds
        takeUntil(this._destroy$),
        filter(() => this._isRunning$.value),
        switchMap(() => from(this._serialAdapter.isPortConnected(port))),
        distinctUntilChanged(),
        tap((isConnected) => {
          if (!isConnected) {
            this._logger.warn(`Port ${port} disconnected`);
            this._updatePortStats(port, true);
          }
        }),
      )
      .subscribe({
        error: (error) => {
          this._logger.error(`Connection monitoring failed for ${port}:`, error);
        },
      });
  }

  private _startConnectionHealthMonitoring(): void {
    timer(0, 10000)
      .pipe(
        // Update every 10 seconds
        takeUntil(this._destroy$),
        filter(() => this._isRunning$.value),
        switchMap(() => this._updateConnectionHealth()),
      )
      .subscribe({
        error: (error) => {
          this._logger.error('Connection health monitoring error:', error);
        },
      });
  }

  private _updateConnectionHealth(): Observable<void> {
    const healthChecks = this._connectedPorts.map((port) =>
      from(this._serialAdapter.getConnectionState(port)).pipe(
        map((state) => {
          const portStats = this._portStats.get(port);
          const issues: string[] = [];

          if (!state.isOpen) {
            issues.push('Port not connected');
          }

          if (state.lastError) {
            issues.push(`Last error: ${state.lastError}`);
          }

          if (portStats && portStats.errors > 10) {
            issues.push(`High error count: ${portStats.errors}`);
          }

          const now = Date.now();
          const connectionDuration = this._startTime ? now - this._startTime : 0;

          if (portStats && now - portStats.lastMessage.getTime() > 30000) {
            issues.push('No recent messages (>30s)');
          }

          return {
            port,
            isHealthy: issues.length === 0 && state.isOpen,
            issues,
            connectionDuration,
          } as LoadCellConnectionHealth;
        }),
        catchError((error) => {
          this._logger.debug(`Failed to get health for ${port}:`, error.message);
          return of({
            port,
            isHealthy: false,
            issues: [`Health check failed: ${error.message}`],
            connectionDuration: 0,
          } as LoadCellConnectionHealth);
        }),
      ),
    );

    return forkJoin(healthChecks).pipe(
      tap((healthArray) => {
        this._connectionHealth$.next(healthArray);
      }),
      map(() => void 0),
      catchError((error) => {
        this._logger.error('Failed to update connection health:', error);
        return of(void 0);
      }),
    );
  }

  private _updatePortStats(port: string, isError: boolean): void {
    const stats = this._portStats.get(port);
    if (stats) {
      if (isError) {
        stats.errors++;
      } else {
        stats.messagesReceived++;
      }
      stats.lastMessage = new Date();
      this._portStats.set(port, stats);
    }
  }

  private _startPerformanceMonitoring(): void {
    interval(5000)
      .pipe(
        // Update every 5 seconds
        takeUntil(this._destroy$),
        tap(() => this._updatePerformanceStats()),
      )
      .subscribe({
        error: (error) => {
          this._logger.error('Performance monitoring error:', error);
        },
      });
  }

  private _updatePerformanceStats(): void {
    const now = Date.now();
    const timeDiff = (now - this._lastReadingTime) / 1000; // seconds
    const messagesPerSecond = timeDiff > 0 ? this._readingsCount / timeDiff : 0;
    const errorRate = this._readingsCount > 0 ? this._errorsCount / this._readingsCount : 0;
    const avgResponseTime = this._connectedPorts.length > 0 ? this._config.initTimer : 0;

    const performanceStats: LoadCellPerformanceStats = {
      messagesPerSecond,
      errorRate,
      avgResponseTime,
      lastActivityTime: new Date(this._lastReadingTime),
      portStatistics: new Map(this._portStats),
    };

    this._performanceStats$.next(performanceStats);
  }

  private _extractComId(portPath: string): number {
    // Extract COM ID from port path (e.g., COM11 -> 11, /dev/ttyUSB0 -> 0)
    const comMatch = portPath.match(/COM(\d+)/i);
    const ttyMatch = portPath.match(/ttyUSB(\d+)/);

    if (comMatch) {
      return parseInt(comMatch[1]);
    }
    if (ttyMatch) {
      return parseInt(ttyMatch[1]);
    }

    return 0;
  }

  public startDataPolling(): void {
    this._currentMessages$
      .pipe(
        takeUntil(this._destroy$),
        filter(() => this._isRunning$.value),
        debounceTime(100), // Debounce rapid changes
        switchMap((messages) => this._pollMessages(messages)),
      )
      .subscribe({
        error: (error) => {
          this._logger.error('Polling error:', error);
          this._callErrorHooks(error, 'Data polling');
          this._isRunning$.next(false);
        },
      });
  }

  public stopDataPolling(): void {
    this._currentMessages$.next([]);
    this._updateStats();
  }

  private _pollMessages(messages: LoadCellDevice[]): Observable<void> {
    if (messages.length === 0) {
      return timer(1000).pipe(map(() => void 0));
    }

    const totalInterval = this._config.initTimer * messages.length;
    const messageInterval = totalInterval / messages.length;

    return from(messages).pipe(
      mergeMap((message, index) =>
        timer(index * messageInterval).pipe(
          switchMap(() => this._sendMessage(message)),
          catchError((error) => {
            this._logger.error(`Failed to send message ${message.no}:`, error);
            this._callErrorHooks(error, `Message ${message.no}`);
            return EMPTY;
          }),
        ),
      ),
      switchMap(() => timer(totalInterval).pipe(map(() => void 0))),
    );
  }

  private _sendMessage(message: LoadCellDevice): Observable<void> {
    if (this._connectedPorts.length === 0) {
      return EMPTY;
    }

    const buffer = this._bufferFromBufferString(message.data);

    // Send to ALL ports using Promise-based adapter
    const sendOperations = this._connectedPorts.map((port) =>
      from(this._serialAdapter.write(port, buffer)).pipe(
        tap(() => {
          if (this._config.logLevel > 0) {
            this._logger.debug(`Sent message ${message.no} to ${port}`);
          }
        }),
        retry({ count: 2, delay: 500 }),
        catchError((error) => {
          this._logger.error(`Failed to send to ${port}:`, error);
          this._updatePortStats(port, true);
          return of(false); // Return false instead of EMPTY to continue
        }),
      ),
    );

    // Send to all ports in parallel
    return forkJoin(sendOperations).pipe(
      map(() => void 0),
      catchError((error) => {
        this._logger.error('Failed to send message to all ports:', error);
        return of(void 0);
      }),
    );
  }

  private _parseRawData(port: string, buffer: Buffer, comId: number): LoadCellReading | null {
    try {
      const rawPayload = Array.from(buffer);

      // Validate data
      if (!this._validateRawData(rawPayload)) {
        return null;
      }

      const rawDeviceId = rawPayload[1];

      // Handle special case for device ID 1
      if (rawDeviceId === 1) {
        rawPayload[2] = 0x3d;
      }

      // CRC validation
      const crcData = rawPayload.slice(1);
      if (this._crc16Validation(crcData) !== 0) {
        this._logger.warn(`CRC validation failed for device ${rawDeviceId}`);
        this._errorsCount++;

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

      // Calculate weight value (32-bit little endian)
      const value = (rawPayload[8] << 24) | (rawPayload[7] << 16) | (rawPayload[6] << 8) | rawPayload[5];

      this._readingsCount++;
      this._lastReadingTime = Date.now();

      return {
        path: port,
        deviceId: comId * 100 + rawDeviceId,
        rawDeviceId,
        weight: value / this._config.precision,
        status: 'running',
        timestamp: new Date(),
        rawData: rawPayload,
      };
    } catch (error) {
      this._logger.error('Failed to parse raw data:', error);
      this._errorsCount++;
      this._callErrorHooks(error as Error, 'Data parsing');
      return null;
    }
  }

  private _validateRawData(rawPayload: number[]): boolean {
    if (!rawPayload.length || rawPayload.length < this._config.messageLength) {
      this._logger.warn('Data invalid: insufficient length');
      return false;
    }

    if (!this._messageAddresses.includes(rawPayload[1])) {
      this._logger.warn(`Invalid device address: ${rawPayload[1]}`);
      return false;
    }

    if (rawPayload[0] !== this._config.charStart) {
      this._logger.warn(`Invalid start character: ${rawPayload[0]}`);
      return false;
    }

    return true;
  }

  private _processReading(reading: LoadCellReading): void {
    if (this._config.logLevel > 0) {
      this._logger.debug(`Device ${reading.rawDeviceId}: ${reading.weight}kg [${reading.status}]`);
    }

    if (this._discoveryPhase && reading.status === 'running') {
      const currentOnline = this._onlineDevices$.value;
      if (!currentOnline.includes(reading.rawDeviceId)) {
        const newOnline = [...currentOnline, reading.rawDeviceId];
        this._onlineDevices$.next(newOnline);
        this._callDeviceDiscoveryHooks(reading.rawDeviceId, true);
        this._logger.log(`Device ${reading.rawDeviceId} discovered (${newOnline.length} total)`);
      }
    }
  }

  private _scheduleDiscoveryTimeout(): void {
    timer(this._config.discoveryTimeout)
      .pipe(
        takeUntil(this._destroy$),
        filter(() => this._discoveryPhase),
      )
      .subscribe(() => {
        this._endDiscoveryPhase();
      });
  }

  private _endDiscoveryPhase(): void {
    const onlineDevices = this._onlineDevices$.value;

    if (onlineDevices.length > 0) {
      this._discoveryPhase = false;
      this.setActiveDevices(onlineDevices);
      this._logger.log(`Discovery phase ended. Found ${onlineDevices.length} online devices: [${onlineDevices.join(', ')}]`);
    } else {
      this._logger.warn('No devices discovered, continuing discovery...');
    }
  }

  private _updateStats(): void {
    const currentMessages = this._currentMessages$.value;
    const onlineDevices = this._onlineDevices$.value;

    const stats: LoadCellStats = {
      totalMessages: this._allMessages.length,
      onlineDevices,
      activeMessages: currentMessages.length,
      readingsCount: this._readingsCount,
      errorsCount: this._errorsCount,
      lastReading: new Date(this._lastReadingTime),
    };

    this._stats$.next(stats);
  }

  private _createInitialStats(): LoadCellStats {
    return {
      totalMessages: this._allMessages?.length || 0,
      onlineDevices: [],
      activeMessages: this._allMessages?.length || 0,
      readingsCount: 0,
      errorsCount: 0,
    };
  }

  private _createInitialPerformanceStats(): LoadCellPerformanceStats {
    return {
      messagesPerSecond: 0,
      errorRate: 0,
      avgResponseTime: 0,
      lastActivityTime: new Date(),
      portStatistics: new Map(),
    };
  }

  private _callDataHooks(reading: LoadCellReading): void {
    if (this._globalHooks.onData) {
      try {
        this._globalHooks.onData(reading);
      } catch (error) {
        this._logger.error('Error in global data hook:', error);
      }
    }

    for (const [contextId, hooks] of this._hooks) {
      if (hooks.onData) {
        try {
          hooks.onData(reading);
        } catch (error) {
          this._logger.error(`Error in data hook for ${contextId}:`, error);
        }
      }
    }
  }

  private _callErrorHooks(error: Error, context?: string): void {
    if (this._globalHooks.onError) {
      try {
        this._globalHooks.onError(error, context);
      } catch (err) {
        this._logger.error('Error in global error hook:', err);
      }
    }

    for (const [contextId, hooks] of this._hooks) {
      if (hooks.onError) {
        try {
          hooks.onError(error, context);
        } catch (err) {
          this._logger.error(`Error in error hook for ${contextId}:`, err);
        }
      }
    }
  }

  private _callDeviceDiscoveryHooks(deviceId: number, isOnline: boolean): void {
    if (this._globalHooks.onDeviceDiscovery) {
      try {
        this._globalHooks.onDeviceDiscovery(deviceId, isOnline);
      } catch (error) {
        this._logger.error('Error in global device discovery hook:', error);
      }
    }

    for (const [contextId, hooks] of this._hooks) {
      if (hooks.onDeviceDiscovery) {
        try {
          hooks.onDeviceDiscovery(deviceId, isOnline);
        } catch (error) {
          this._logger.error(`Error in device discovery hook for ${contextId}:`, error);
        }
      }
    }
  }

  private _callStatusChangeHooks(isRunning: boolean): void {
    if (this._globalHooks.onStatusChange) {
      try {
        this._globalHooks.onStatusChange(isRunning);
      } catch (error) {
        this._logger.error('Error in global status change hook:', error);
      }
    }

    for (const [contextId, hooks] of this._hooks) {
      if (hooks.onStatusChange) {
        try {
          hooks.onStatusChange(isRunning);
        } catch (error) {
          this._logger.error(`Error in status change hook for ${contextId}:`, error);
        }
      }
    }
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

  private _getBufferContent(message: string): string {
    return message.replace(/[<>]/g, '').split(' ').slice(1).join('');
  }

  private _crc16Validation(arr: number[]): number {
    let crc = 65535; // 0xFFFF

    for (let i = 0; i < arr.length; i++) {
      crc = crc ^ arr[i];
      for (let j = 8; j > 0; j--) {
        if ((crc & 1) !== 0) {
          crc = crc >> 1;
          crc = crc ^ 40961; // 0xA001
        } else {
          crc = crc >> 1;
        }
      }
    }

    return crc;
  }
}
