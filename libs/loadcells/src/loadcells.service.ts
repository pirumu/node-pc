import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectSerialManager, ISerialAdapter } from '@serialport/serial';
import { Observable, Subject, BehaviorSubject, timer, EMPTY, from, forkJoin } from 'rxjs';
import { map, takeUntil, tap, catchError, switchMap, filter, retry, mergeMap } from 'rxjs/operators';

import { ALL_MESSAGES } from './loadcells.contants';
import { LoadCellConfig, LoadCellDevice, LoadCellHooks, LoadCellReading, LoadCellStats } from './loadcells.types';

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

  // Hooks registry
  private readonly _hooks = new Map<string, LoadCellHooks>();
  private _globalHooks: LoadCellHooks = {};

  // Internal state
  private _connectedPorts: string[] = [];
  private _discoveryPhase = true;
  private _readingsCount = 0;
  private _errorsCount = 0;

  private readonly _allMessages: LoadCellDevice[] = ALL_MESSAGES;

  private readonly _messageAddresses: number[];

  constructor(@InjectSerialManager() private readonly _serialAdapter: ISerialAdapter) {
    this._messageAddresses = this._allMessages.map((msg) => parseInt(this._getBufferContent(msg.data).slice(0, 2), 16));
    this._currentMessages$.next([...this._allMessages]);
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
    this._scheduleDiscoveryTimeout();

    this._isRunning$.next(true);
    this._callStatusChangeHooks(true);
  }

  public stop(): void {
    if (!this._isRunning$.value) {
      return;
    }

    this._logger.log('Stopping loadcells service');
    this._isRunning$.next(false);
    this._connectedPorts = [];
    this._discoveryPhase = true;
    this._onlineDevices$.next([]);
    this._currentMessages$.next([...this._allMessages]);

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

  public refreshStats(): void {
    this._updateStats();
  }

  private async _connectToPorts(): Promise<void> {
    if (this._connectedPorts.length === 0) {
      return;
    }

    for (const port of this._connectedPorts) {
      this._logger.log(`Connecting to port: ${port}`);

      // Extract COM ID for each port
      const comId = this._extractComId(port);

      // Subscribe to data from EACH port
      this._serialAdapter
        .onData(port)
        .pipe(
          takeUntil(this._destroy$),
          map((data) => this._parseRawData(port, data, comId)), // Pass comId
          filter(Boolean),
          tap((reading) => this._processReading(reading)),
        )
        .subscribe({
          next: (reading) => {
            this._callDataHooks(reading);
            this._updateStats();
          },
          error: (error) => {
            this._logger.error(`Data stream error for ${port}:`, error);
            this._callErrorHooks(error, `Data stream for ${port}`);
          },
        });

      // Subscribe to errors from EACH port
      this._serialAdapter
        .onError(port)
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (error) => {
            this._errorsCount++;
            this._callErrorHooks(error, `Serial port ${port}`);
            this._updateStats();
          },
        });
    }
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
    // Send it to ALL ports
    const sendOperations = this._connectedPorts.map((port) =>
      this._serialAdapter.write(port, buffer).pipe(
        tap(() => {
          if (this._config.logLevel > 0) {
            this._logger.debug(`Sent message ${message.no} to ${port}`);
          }
        }),
        retry(2),
        catchError((error) => {
          this._logger.error(`Failed to send to ${port}:`, error);
          return EMPTY;
        }),
      ),
    );

    // Send to all ports in parallel
    return forkJoin(sendOperations).pipe(map(() => void 0));
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
          deviceId: comId * 100 + rawDeviceId, // Use passed comId
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

      return {
        path: port,
        deviceId: comId * 100 + rawDeviceId, // Use passed comId
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
      lastReading: new Date(),
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
