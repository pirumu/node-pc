import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { addMilliseconds, formatDistanceToNow } from 'date-fns';
import { Observable, Subject, BehaviorSubject, timer } from 'rxjs';
import { takeUntil, catchError, switchMap } from 'rxjs/operators';

import { LoadcellsService } from './loadcells.service';
import {
  DeviceConnectionEvent,
  DeviceHealthHooks,
  DeviceHealthStats,
  DeviceHeartbeat,
  DeviceStatusPayload,
  HealthMonitoringConfig,
  LoadCellReading,
} from './loadcells.types';

@Injectable()
export class LoadcellsHealthMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(LoadcellsHealthMonitoringService.name);
  private readonly _destroy$ = new Subject<void>();

  // Configuration
  private readonly _config: HealthMonitoringConfig = {
    enabled: true,
    checkInterval: 3000, // 3 seconds (same as original)
    heartbeatTimeout: 10000, // 10 seconds (same as original)
    logConnectionChanges: true,
  };

  // State management
  private readonly _deviceHeartbeats$ = new BehaviorSubject<Map<number, DeviceHeartbeat>>(new Map());
  private readonly _healthStats$ = new BehaviorSubject<DeviceHealthStats>(this._createInitialStats());

  // Hooks registry
  private readonly _hooks = new Map<string, DeviceHealthHooks>();
  private _globalHooks: DeviceHealthHooks = {};

  // Internal tracking
  private _loadCellDevices = new Set<number>();
  private _previousConnectionStates = new Map<number, boolean>();

  constructor(private readonly _loadCellService: LoadcellsService) {}

  public onModuleInit(): void {
    this._logger.log('Initializing Device Health Monitoring Service');
    this._registerLoadCellHooks();
    this._startHealthMonitoring();
  }

  public onModuleDestroy(): void {
    this._logger.log('Shutting down Device Health Monitoring Service');

    this._loadCellService.unregisterHooks('health-monitoring');
    this._destroy$.next();
    this._destroy$.complete();
  }

  public registerGlobalHooks(hooks: DeviceHealthHooks): void {
    this._globalHooks = { ...this._globalHooks, ...hooks };
    this._logger.log('Global device health hooks registered');
  }

  public registerHooks(contextId: string, hooks: DeviceHealthHooks): void {
    this._hooks.set(contextId, hooks);
    this._logger.log(`Device health hooks registered for context: ${contextId}`);
  }

  public unregisterHooks(contextId: string): void {
    this._hooks.delete(contextId);
    this._logger.log(`Device health hooks unregistered for context: ${contextId}`);
  }

  public clearAllHooks(): void {
    this._hooks.clear();
    this._globalHooks = {};
    this._logger.log('All device health hooks cleared');
  }

  public get deviceHeartbeats$(): Observable<Map<number, DeviceHeartbeat>> {
    return this._deviceHeartbeats$.pipe(takeUntil(this._destroy$));
  }

  public get healthStats$(): Observable<DeviceHealthStats> {
    return this._healthStats$.pipe(takeUntil(this._destroy$));
  }

  public updateHeartbeat(deviceId: number, source: 'loadcell', metadata?: any): void {
    const currentHeartbeats = this._deviceHeartbeats$.value;
    const timestamp = Date.now();

    const heartbeat: DeviceHeartbeat = {
      deviceId,
      lastSeen: timestamp,
      isConnected: true,
      source,
      metadata,
    };

    currentHeartbeats.set(deviceId, heartbeat);
    this._deviceHeartbeats$.next(currentHeartbeats);

    this._loadCellDevices.add(deviceId);

    this._updateHealthStats();
    this._logger.debug(`Heartbeat updated for device ${deviceId} from ${source}`);

    this._callDeviceStatusHooks({
      id: deviceId,
      deviceId,
      isConnected: true,
      lastSeen: timestamp,
      source,
      metadata,
    });
  }

  public isDeviceAlive(deviceId: number): boolean {
    const heartbeat = this._deviceHeartbeats$.value.get(deviceId);
    return this._isAlive(heartbeat, Date.now());
  }

  public getDeviceStatus(deviceId: number): DeviceHeartbeat | undefined {
    return this._deviceHeartbeats$.value.get(deviceId);
  }

  public getConnectedDevices(): number[] {
    const currentTime = Date.now();
    const connected: number[] = [];

    for (const [deviceId, heartbeat] of this._deviceHeartbeats$.value) {
      if (this._isAlive(heartbeat, currentTime)) {
        connected.push(deviceId);
      }
    }

    return connected;
  }

  public getDisconnectedDevices(): number[] {
    const currentTime = Date.now();
    const disconnected: number[] = [];

    for (const [deviceId, heartbeat] of this._deviceHeartbeats$.value) {
      if (!this._isAlive(heartbeat, currentTime)) {
        disconnected.push(deviceId);
      }
    }

    return disconnected;
  }

  public async forceHealthCheck(): Promise<void> {
    await this._performHealthCheck();
  }

  public clearDevice(deviceId: number): void {
    const currentHeartbeats = this._deviceHeartbeats$.value;
    const heartbeat = currentHeartbeats.get(deviceId);

    if (heartbeat) {
      // Call connection change hook before removing
      this._callConnectionChangeHooks({
        deviceId,
        isConnected: false,
        previousState: heartbeat.isConnected,
        source: heartbeat.source,
        timestamp: new Date(),
        metadata: { action: 'manual_removal' },
      });
    }

    currentHeartbeats.delete(deviceId);
    this._deviceHeartbeats$.next(currentHeartbeats);

    this._loadCellDevices.delete(deviceId);
    this._previousConnectionStates.delete(deviceId);
    this._updateHealthStats();

    this._logger.debug(`Cleared device ${deviceId} from health monitoring`);
  }

  public getCurrentStats(): DeviceHealthStats {
    return this._healthStats$.value;
  }

  public setTrackingDevices(devices: Array<{ deviceId: number; source?: 'loadcell'; metadata?: any }>): void {
    const currentHeartbeats = this._deviceHeartbeats$.value;

    devices.forEach(({ deviceId, source = 'loadcell', metadata }) => {
      // Initialize with unknown connection state
      const heartbeat: DeviceHeartbeat = {
        deviceId,
        lastSeen: 0, // Will be updated when first data comes in
        isConnected: false,
        source,
        metadata: { ...metadata, initializedFromDb: true },
      };

      currentHeartbeats.set(deviceId, heartbeat);
    });

    this._deviceHeartbeats$.next(currentHeartbeats);
    this._updateHealthStats();

    this._logger.log(`Set tracking for ${devices.length} devices: [${devices.map((d) => d.deviceId).join(', ')}]`);
  }

  public addTrackingDevice(deviceId: number, source: 'loadcell', metadata?: any): void {
    const currentHeartbeats = this._deviceHeartbeats$.value;

    if (currentHeartbeats.has(deviceId)) {
      this._logger.warn(`Device ${deviceId} is already being tracked`);
      return;
    }

    const heartbeat: DeviceHeartbeat = {
      deviceId,
      lastSeen: 0,
      isConnected: false,
      source,
      metadata: { ...metadata, addedManually: true },
    };

    currentHeartbeats.set(deviceId, heartbeat);
    this._deviceHeartbeats$.next(currentHeartbeats);

    this._updateHealthStats();
    this._logger.log(`Added device ${deviceId} to tracking (${source})`);
  }

  /**
   * Remove device from tracking
   */
  public removeTrackingDevice(deviceId: number): void {
    const currentHeartbeats = this._deviceHeartbeats$.value;
    const heartbeat = currentHeartbeats.get(deviceId);

    if (heartbeat) {
      // Call connection change hook before removing
      this._callConnectionChangeHooks({
        deviceId,
        isConnected: false,
        previousState: heartbeat.isConnected,
        source: heartbeat.source,
        timestamp: new Date(),
        metadata: { action: 'removed_from_tracking' },
      });
    }

    currentHeartbeats.delete(deviceId);
    this._deviceHeartbeats$.next(currentHeartbeats);

    this._loadCellDevices.delete(deviceId);
    this._previousConnectionStates.delete(deviceId);
    this._updateHealthStats();

    this._logger.log(`Removed device ${deviceId} from tracking`);
  }

  public getTrackingDevices(): { deviceId: number; source: string; isConnected: boolean; lastSeen: number }[] {
    const currentTime = Date.now();
    const devices: Array<{ deviceId: number; source: string; isConnected: boolean; lastSeen: number }> = [];

    for (const [deviceId, heartbeat] of this._deviceHeartbeats$.value) {
      devices.push({
        deviceId,
        source: heartbeat.source,
        isConnected: this._isAlive(heartbeat, currentTime),
        lastSeen: heartbeat.lastSeen,
      });
    }

    return devices.sort((a, b) => a.deviceId - b.deviceId);
  }

  public clearTrackingDevices(): void {
    const deviceCount = this._deviceHeartbeats$.value.size;

    this._deviceHeartbeats$.next(new Map());
    this._loadCellDevices.clear();
    this._previousConnectionStates.clear();
    this._updateHealthStats();

    this._logger.log(`Cleared all ${deviceCount} devices from tracking`);
  }

  public updateDeviceMetadata(deviceId: number, metadata: any): void {
    const currentHeartbeats = this._deviceHeartbeats$.value;
    const heartbeat = currentHeartbeats.get(deviceId);

    if (heartbeat) {
      heartbeat.metadata = { ...heartbeat.metadata, ...metadata };
      currentHeartbeats.set(deviceId, heartbeat);
      this._deviceHeartbeats$.next(currentHeartbeats);
      this._logger.debug(`Updated metadata for device ${deviceId}`);
    } else {
      this._logger.warn(`Cannot update metadata for device ${deviceId}: not being tracked`);
    }
  }

  public bulkUpdateHeartbeats(updates: Array<{ deviceId: number; lastSeen?: number; metadata?: any }>): void {
    const currentHeartbeats = this._deviceHeartbeats$.value;
    let updatedCount = 0;

    updates.forEach(({ deviceId, lastSeen, metadata }) => {
      const heartbeat = currentHeartbeats.get(deviceId);

      if (heartbeat) {
        if (lastSeen !== undefined) {
          heartbeat.lastSeen = lastSeen;
          heartbeat.isConnected = this._isAlive(heartbeat, Date.now());
        }

        if (metadata) {
          heartbeat.metadata = { ...heartbeat.metadata, ...metadata };
        }

        currentHeartbeats.set(deviceId, heartbeat);
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      this._deviceHeartbeats$.next(currentHeartbeats);
      this._updateHealthStats();
      this._logger.debug(`Bulk updated ${updatedCount} device heartbeats`);
    }
  }

  // ==================== PRIVATE METHODS ====================

  private _registerLoadCellHooks(): void {
    this._loadCellService.registerHooks('health-monitoring', {
      onData: async (reading: LoadCellReading) => {
        // Update heartbeat on every successful reading
        if (reading.status === 'running') {
          this.updateHeartbeat(reading.rawDeviceId, 'loadcell', {
            weight: reading.weight,
            path: reading.path,
            fullDeviceId: reading.deviceId,
          });
        }
      },

      onError: (error: Error, context?: string) => {
        this._logger.warn(`LoadCell error affecting health monitoring: ${error.message}`);
        this._callErrorHooks(error, undefined, `LoadCell: ${context}`);
      },

      onDeviceDiscovery: (deviceId: number, isOnline: boolean) => {
        if (isOnline) {
          this.updateHeartbeat(deviceId, 'loadcell', { discovered: true });
        } else {
          // Device went offline
          const heartbeat = this._deviceHeartbeats$.value.get(deviceId);
          if (heartbeat) {
            this._handleDeviceDisconnection(deviceId, heartbeat);
          }
        }
      },
    });
  }

  private _startHealthMonitoring(): void {
    if (!this._config.enabled) {
      this._logger.log('Health monitoring is disabled');
      return;
    }

    // Periodic health check
    timer(0, this._config.checkInterval)
      .pipe(
        takeUntil(this._destroy$),
        switchMap(async () => this._performHealthCheck()),
        catchError((error) => {
          this._logger.error('Health check error:', error);
          this._callErrorHooks(error, undefined, 'Health check');
          return timer(1000); // Retry after 1 second
        }),
      )
      .subscribe();

    this._logger.log(`Health monitoring started with ${this._config.checkInterval}ms interval`);
  }

  private async _performHealthCheck(): Promise<void> {
    try {
      await this._checkAndCallDeviceHooks();

      this._updateHealthStats();
    } catch (error) {
      this._logger.error('Error during health check:', error);
      this._callErrorHooks(error as Error, undefined, 'Health check');
    }
  }

  private async _checkAndCallDeviceHooks(): Promise<void> {
    const currentTime = Date.now();
    const statusUpdates: DeviceStatusPayload[] = [];
    const connectionChanges: DeviceConnectionEvent[] = [];

    // Check all tracked devices
    for (const [deviceId, heartbeat] of this._deviceHeartbeats$.value) {
      const isConnected = this._isAlive(heartbeat, currentTime);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const previousState = this._previousConnectionStates.get(deviceId);

      // Update connection status if changed
      if (heartbeat.isConnected !== isConnected) {
        heartbeat.isConnected = isConnected;
        this._deviceHeartbeats$.value.set(deviceId, heartbeat);

        // Track connection change
        const connectionEvent: DeviceConnectionEvent = {
          deviceId,
          isConnected,
          previousState,
          source: heartbeat.source,
          timestamp: new Date(),
          metadata: heartbeat.metadata,
        };

        connectionChanges.push(connectionEvent);
        this._previousConnectionStates.set(deviceId, isConnected);

        // Log connection changes
        if (this._config.logConnectionChanges) {
          const status = isConnected ? 'CONNECTED' : 'DISCONNECTED';
          this._logger.log(`Device ${deviceId}: ${status} (${heartbeat.source})`);
        }
      }

      const statusPayload: DeviceStatusPayload = {
        id: heartbeat.metadata?.dbId || deviceId,
        deviceId: deviceId,
        isConnected,
        lastSeen: heartbeat.lastSeen,
        source: heartbeat.source,
        metadata: heartbeat.metadata,
      };

      statusUpdates.push(statusPayload);
    }

    // Call hooks for all status updates
    if (statusUpdates.length > 0) {
      this._callBatchStatusHooks(statusUpdates);
    }

    // Call hooks for connection changes
    for (const connectionEvent of connectionChanges) {
      this._callConnectionChangeHooks(connectionEvent);
    }

    this._logger.debug(`Processed ${statusUpdates.length} device statuses, ${connectionChanges.length} connection changes`);
  }

  private _handleDeviceDisconnection(deviceId: number, heartbeat: DeviceHeartbeat): void {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const previousState = heartbeat.isConnected;
    heartbeat.isConnected = false;
    heartbeat.lastSeen = Date.now();
    this._deviceHeartbeats$.value.set(deviceId, heartbeat);

    this._callConnectionChangeHooks({
      deviceId,
      isConnected: false,
      previousState,
      source: heartbeat.source,
      timestamp: new Date(),
      metadata: { reason: 'device_discovery_lost' },
    });

    this._updateHealthStats();
  }

  private _isAlive(heartbeat: DeviceHeartbeat | undefined, currentTime: number): boolean {
    if (!heartbeat || !heartbeat.lastSeen) {
      return false;
    }

    const timeoutThreshold = addMilliseconds(new Date(heartbeat.lastSeen), this._config.heartbeatTimeout).getTime();

    const isAlive = currentTime <= timeoutThreshold;

    if (this._config.checkInterval <= 5000) {
      // Debug logging for frequent checks
      this._logger.debug(
        `Device ${heartbeat.deviceId} alive check: ${isAlive} (last seen: ${formatDistanceToNow(new Date(heartbeat.lastSeen), { addSuffix: true })})`,
      );
    }

    return isAlive;
  }

  private _updateHealthStats(): void {
    const currentTime = Date.now();
    const heartbeats = this._deviceHeartbeats$.value;

    let connectedCount = 0;
    let disconnectedCount = 0;

    for (const [_, heartbeat] of heartbeats) {
      if (this._isAlive(heartbeat, currentTime)) {
        connectedCount++;
      } else {
        disconnectedCount++;
      }
    }

    const stats: DeviceHealthStats = {
      totalDevices: heartbeats.size,
      connectedDevices: connectedCount,
      disconnectedDevices: disconnectedCount,
      loadCellDevices: this._loadCellDevices.size,
      lastCheck: new Date(),
    };

    this._healthStats$.next(stats);
    this._callHealthStatsHooks(stats);
  }

  private _createInitialStats(): DeviceHealthStats {
    return {
      totalDevices: 0,
      connectedDevices: 0,
      disconnectedDevices: 0,
      loadCellDevices: 0,
      lastCheck: new Date(),
    };
  }

  // ==================== HOOK CALLING METHODS ====================

  private _callDeviceStatusHooks(status: DeviceStatusPayload): void {
    // Call global hooks
    if (this._globalHooks.onDeviceStatus) {
      try {
        this._globalHooks.onDeviceStatus(status);
      } catch (error) {
        this._logger.error('Error in global device status hook:', error);
      }
    }

    // Call context-specific hooks
    for (const [contextId, hooks] of this._hooks) {
      if (hooks.onDeviceStatus) {
        try {
          hooks.onDeviceStatus(status);
        } catch (error) {
          this._logger.error(`Error in device status hook for ${contextId}:`, error);
        }
      }
    }
  }

  private _callConnectionChangeHooks(event: DeviceConnectionEvent): void {
    // Call global hooks
    if (this._globalHooks.onConnectionChange) {
      try {
        this._globalHooks.onConnectionChange(event);
      } catch (error) {
        this._logger.error('Error in global connection change hook:', error);
      }
    }

    // Call context-specific hooks
    for (const [contextId, hooks] of this._hooks) {
      if (hooks.onConnectionChange) {
        try {
          hooks.onConnectionChange(event);
        } catch (error) {
          this._logger.error(`Error in connection change hook for ${contextId}:`, error);
        }
      }
    }
  }

  private _callHealthStatsHooks(stats: DeviceHealthStats): void {
    // Call global hooks
    if (this._globalHooks.onHealthStats) {
      try {
        this._globalHooks.onHealthStats(stats);
      } catch (error) {
        this._logger.error('Error in global health stats hook:', error);
      }
    }

    // Call context-specific hooks
    for (const [contextId, hooks] of this._hooks) {
      if (hooks.onHealthStats) {
        try {
          hooks.onHealthStats(stats);
        } catch (error) {
          this._logger.error(`Error in health stats hook for ${contextId}:`, error);
        }
      }
    }
  }

  private _callBatchStatusHooks(statuses: DeviceStatusPayload[]): void {
    // Call global hooks
    if (this._globalHooks.onBatchStatus) {
      try {
        this._globalHooks.onBatchStatus(statuses);
      } catch (error) {
        this._logger.error('Error in global batch status hook:', error);
      }
    }

    // Call context-specific hooks
    for (const [contextId, hooks] of this._hooks) {
      if (hooks.onBatchStatus) {
        try {
          hooks.onBatchStatus(statuses);
        } catch (error) {
          this._logger.error(`Error in batch status hook for ${contextId}:`, error);
        }
      }
    }
  }

  private _callErrorHooks(error: Error, deviceId?: number, context?: string): void {
    // Call global hooks
    if (this._globalHooks.onError) {
      try {
        this._globalHooks.onError(error, deviceId, context);
      } catch (err) {
        this._logger.error('Error in global error hook:', err);
      }
    }

    // Call context-specific hooks
    for (const [contextId, hooks] of this._hooks) {
      if (hooks.onError) {
        try {
          hooks.onError(error, deviceId, context);
        } catch (err) {
          this._logger.error(`Error in error hook for ${contextId}:`, err);
        }
      }
    }
  }
}
