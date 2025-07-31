import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BehaviorSubject, EMPTY, forkJoin, Observable, Subject, timer } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { ConnectionStats, InjectSerialManager, ISerialAdapter, PortStatus } from '../serial';

import { PortDiscoveryService } from './port-discovery.service';

export type ConnectionChangeEvent = {
  timestamp: Date;
  currentConnected: string[];
  added: string[];
  removed: string[];
  totalConnected: number;
  eventType: 'CONNECTED' | 'DISCONNECTED' | 'DISCOVERED' | 'LOST';
};

export type HealthStatus = {
  isHealthy: boolean;
  connectionStats: ConnectionStats;
  systemUptime: number;
  lastUpdate: Date;
  issues: string[];
};

export type MonitoringConfig = {
  enabled: boolean;
  connectionCheckInterval: number; // ms
  healthCheckInterval: number; // ms
  discoveryRefreshInterval: number; // ms
  maxIdleTime: number; // ms
  enableEventLogging: boolean;
};

@Injectable()
export class PortMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger('SerialPortMonitoringService');
  private readonly _destroy$ = new Subject<void>();

  // State management
  private readonly _connectionEvents$ = new Subject<ConnectionChangeEvent>();
  private readonly _healthStatus$ = new BehaviorSubject<HealthStatus>(this._createInitialHealth());
  private readonly _portStatus$ = new BehaviorSubject<PortStatus | null>(null);

  private _lastConnectedPorts: string[] = [];
  private _startTime = Date.now();

  private readonly _defaultConfig: MonitoringConfig = {
    enabled: true,
    connectionCheckInterval: 2000, // 2 seconds
    healthCheckInterval: 10000, // 10 seconds
    discoveryRefreshInterval: 5000, // 5 seconds
    maxIdleTime: 60000, // 1 minute
    enableEventLogging: true,
  };

  private _config = { ...this._defaultConfig };

  constructor(
    private readonly _portDiscovery: PortDiscoveryService,
    @InjectSerialManager() private readonly _serialAdapter: ISerialAdapter,
  ) {}

  public onModuleInit(): void {
    this._logger.log('Initializing Port Monitoring Service');
    this._startMonitoring();
  }

  public onModuleDestroy(): void {
    this._logger.log('Shutting down Port Monitoring Service');
    this._destroy$.next();
    this._destroy$.complete();
  }

  public portStatus$(): Observable<PortStatus> {
    return this._portStatus$.pipe(filter(Boolean), takeUntil(this._destroy$));
  }

  public connectionEvents$(): Observable<ConnectionChangeEvent> {
    return this._connectionEvents$.pipe(takeUntil(this._destroy$));
  }

  public healthStatus$(): Observable<HealthStatus> {
    return this._healthStatus$.pipe(takeUntil(this._destroy$));
  }

  public getCurrentPortStatus(): PortStatus | null {
    return this._portStatus$.value;
  }

  public getCurrentHealthStatus(): HealthStatus {
    return this._healthStatus$.value;
  }

  public getCurrentStats(): ConnectionStats {
    return this._serialAdapter.getConnectionStats();
  }

  public forceRefresh(): Observable<PortStatus> {
    return this._refreshPortStatus();
  }

  public onConnectionEvent(eventType: ConnectionChangeEvent['eventType'], callback: (event: ConnectionChangeEvent) => void): () => void {
    const subscription = this._connectionEvents$.pipe(filter((event) => event.eventType === eventType)).subscribe({
      next: callback,
      error: (err: Error) => this._logger.error(`Connection event error:`, err),
    });

    return () => subscription.unsubscribe();
  }

  private _startMonitoring(): void {
    if (!this._config.enabled) {
      this._logger.log('Port monitoring is disabled');
      return;
    }

    // Start connection monitoring
    this._startConnectionMonitoring();

    // Start health monitoring
    this._startHealthMonitoring();

    // Start discovery monitoring
    this._startDiscoveryMonitoring();

    this._logger.log('Port monitoring started with intervals:', {
      connection: this._config.connectionCheckInterval,
      health: this._config.healthCheckInterval,
      discovery: this._config.discoveryRefreshInterval,
    });
  }

  private _startConnectionMonitoring(): void {
    timer(0, this._config.connectionCheckInterval)
      .pipe(
        map(() => this._serialAdapter.getConnectedPorts()),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
        tap((currentPorts) => this._handleConnectionChange(currentPorts)),
        takeUntil(this._destroy$),
      )
      .subscribe({
        error: (err) => this._logger.error('Connection monitoring error:', err),
      });
  }

  private _startHealthMonitoring(): void {
    timer(0, this._config.healthCheckInterval)
      .pipe(
        map(() => this._createHealthStatus()),
        tap((health) => this._healthStatus$.next(health)),
        takeUntil(this._destroy$),
      )
      .subscribe({
        error: (err) => this._logger.error('Health monitoring error:', err),
      });
  }

  private _startDiscoveryMonitoring(): void {
    timer(0, this._config.discoveryRefreshInterval)
      .pipe(
        switchMap(() => this._refreshPortStatus()),
        debounceTime(500), // Debounce rapid changes
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (status) => this._portStatus$.next(status),
        error: (err) => this._logger.error('Discovery monitoring error:', err),
      });
  }

  private _handleConnectionChange(currentPorts: string[]): void {
    const previousPorts = this._lastConnectedPorts;
    const added = currentPorts.filter((port) => !previousPorts.includes(port));
    const removed = previousPorts.filter((port) => !currentPorts.includes(port));

    if (added.length > 0 || removed.length > 0) {
      const event: ConnectionChangeEvent = {
        timestamp: new Date(),
        currentConnected: [...currentPorts],
        added,
        removed,
        totalConnected: currentPorts.length,
        eventType: added.length > 0 ? 'CONNECTED' : 'DISCONNECTED',
      };

      this._connectionEvents$.next(event);

      if (this._config.enableEventLogging) {
        if (added.length > 0) {
          this._logger.log(`Ports connected: [${added.join(', ')}]`);
        }
        if (removed.length > 0) {
          this._logger.warn(`Ports disconnected: [${removed.join(', ')}]`);
        }
      }
    }

    this._lastConnectedPorts = [...currentPorts];
  }

  private _refreshPortStatus(): Observable<PortStatus> {
    return forkJoin({
      available: this._portDiscovery.availablePorts$(),
      connected: this._serialAdapter.getConnectedPortsInfo(),
    }).pipe(
      map(({ available, connected }) => {
        return {
          availablePorts: available,
          connectedPorts: connected,
          totalAvailable: available.length,
          totalConnected: connected.length,
          unconnectedPorts: available.filter((port) => !connected.some((conn) => conn.path === port.path)),
        };
      }),
      catchError((error) => {
        this._logger.error('Failed to refresh port status:', error);
        return EMPTY;
      }),
    );
  }

  private _createHealthStatus(): HealthStatus {
    const stats = this._serialAdapter.getConnectionStats();
    const issues: string[] = [];

    // Check for issues
    if (stats.failedPorts > 0) {
      issues.push(`${stats.failedPorts} failed port connections`);
    }

    if (stats.connectingPorts > 3) {
      issues.push(`${stats.connectingPorts} ports stuck connecting`);
    }

    const uptime = Date.now() - this._startTime;
    if (uptime > this._config.maxIdleTime && stats.openConnections === 0) {
      issues.push('No active connections for extended period');
    }

    return {
      isHealthy: issues.length === 0,
      connectionStats: stats,
      systemUptime: uptime,
      lastUpdate: new Date(),
      issues,
    };
  }

  private _createInitialHealth(): HealthStatus {
    return {
      isHealthy: true,
      connectionStats: {
        totalConnections: 0,
        openConnections: 0,
        connectingPorts: 0,
        failedPorts: 0,
      },
      systemUptime: 0,
      lastUpdate: new Date(),
      issues: [],
    };
  }
}
