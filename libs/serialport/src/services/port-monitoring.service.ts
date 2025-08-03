import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BehaviorSubject, forkJoin, Observable, Subject, timer, from, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  takeUntil,
  tap,
  mergeMap,
  concatMap,
} from 'rxjs/operators';

import { ConnectionStats, InjectSerialManager, ISerialAdapter, SerialPortState } from '../serial';

import { PortDiscoveryService } from './port-discovery.service';

export type ConnectionChangeEvent = {
  timestamp: Date;
  currentConnected: string[];
  added: string[];
  removed: string[];
  totalConnected: number;
  eventType: 'CONNECTED' | 'DISCONNECTED' | 'DISCOVERED' | 'LOST';
  portDetails?: {
    path: string;
    state?: any;
    error?: string;
  }[];
};

export type HealthStatus = {
  isHealthy: boolean;
  connectionStats: ConnectionStats;
  systemUptime: number;
  lastUpdate: Date;
  issues: string[];
  performance: {
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
  };
};

export type PortPerformanceMetrics = {
  path: string;
  bytesReceived: number;
  bytesSent: number;
  errorCount: number;
  lastActivity: Date;
  connectionDuration: number;
  reconnectCount: number;
};

export type MonitoringConfig = {
  enabled: boolean;
  connectionCheckInterval: number; // ms
  healthCheckInterval: number; // ms
  discoveryRefreshInterval: number; // ms
  maxIdleTime: number; // ms
  enableEventLogging: boolean;
  enablePerformanceTracking: boolean;
  alertThresholds: {
    maxFailedPorts: number;
    maxConnectingTime: number; // ms
    minHealthScore: number;
  };
};

@Injectable()
export class PortMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger('SerialPortMonitoringService');
  private readonly _destroy$ = new Subject<void>();

  // State management
  private readonly _connectionEvents$ = new Subject<ConnectionChangeEvent>();
  private readonly _healthStatus$ = new BehaviorSubject<HealthStatus>(this._createInitialHealth());
  private readonly _portStatus$ = new BehaviorSubject<SerialPortState | null>(null);
  private readonly _performanceMetrics$ = new BehaviorSubject<Map<string, PortPerformanceMetrics>>(new Map());

  private _lastConnectedPorts: string[] = [];
  private _startTime = Date.now();
  private _responseTimeSamples: number[] = [];

  private readonly _defaultConfig: MonitoringConfig = {
    enabled: false,
    connectionCheckInterval: 2000, // 2 seconds
    healthCheckInterval: 10000, // 10 seconds
    discoveryRefreshInterval: 5000, // 5 seconds
    maxIdleTime: 60000, // 1 minute
    enableEventLogging: true,
    enablePerformanceTracking: true,
    alertThresholds: {
      maxFailedPorts: 3,
      maxConnectingTime: 30000, // 30 seconds
      minHealthScore: 0.8,
    },
  };

  private _config = { ...this._defaultConfig };

  constructor(
    private readonly _portDiscovery: PortDiscoveryService,
    @InjectSerialManager() private readonly _serialAdapter: ISerialAdapter,
  ) {}

  public onModuleInit(): void {
    this._logger.log('Initializing Port Monitoring Service');
    if (this._config.enabled) {
      this._startMonitoring();
    }
  }

  public onModuleDestroy(): void {
    this._logger.log('Shutting down Port Monitoring Service');
    this._destroy$.next();
    this._destroy$.complete();
  }

  public portStatus$(): Observable<SerialPortState> {
    return this._portStatus$.pipe(filter(Boolean), takeUntil(this._destroy$));
  }

  public connectionEvents$(): Observable<ConnectionChangeEvent> {
    return this._connectionEvents$.pipe(takeUntil(this._destroy$));
  }

  public healthStatus$(): Observable<HealthStatus> {
    return this._healthStatus$.pipe(takeUntil(this._destroy$));
  }

  public performanceMetrics$(): Observable<PortPerformanceMetrics[]> {
    return this._performanceMetrics$.pipe(
      map((metricsMap) => Array.from(metricsMap.values())),
      takeUntil(this._destroy$),
    );
  }

  public getCurrentPortStatus(): SerialPortState | null {
    return this._portStatus$.value;
  }

  public getCurrentHealthStatus(): HealthStatus {
    return this._healthStatus$.value;
  }

  public getCurrentStats(): Observable<ConnectionStats> {
    return from(this._serialAdapter.getConnectionStats()).pipe(
      catchError((error) => {
        this._logger.error('Failed to get current stats:', error);
        return of({
          totalConnections: 0,
          openConnections: 0,
          connectingPorts: 0,
          failedPorts: 0,
        });
      }),
    );
  }

  public forceRefresh(): Observable<SerialPortState> {
    return this._refreshPortStatus();
  }

  public getPortMetrics(path: string): PortPerformanceMetrics | undefined {
    return this._performanceMetrics$.value.get(path);
  }

  public getAllPortMetrics(): Observable<PortPerformanceMetrics[]> {
    return this.performanceMetrics$();
  }

  public resetMetrics(path?: string): Observable<void> {
    return of(null).pipe(
      tap(() => {
        if (path) {
          const metrics = this._performanceMetrics$.value;
          metrics.delete(path);
          this._performanceMetrics$.next(metrics);
          this._logger.log(`Metrics reset for port: ${path}`);
        } else {
          this._performanceMetrics$.next(new Map());
          this._logger.log('All metrics reset');
        }
      }),
      map(() => void 0),
    );
  }

  public onConnectionEvent(eventType: ConnectionChangeEvent['eventType'], callback: (event: ConnectionChangeEvent) => void): () => void {
    const subscription = this._connectionEvents$
      .pipe(
        filter((event) => event.eventType === eventType),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: callback,
        error: (err: Error) => this._logger.error(`Connection event error:`, err),
      });

    return () => subscription.unsubscribe();
  }

  public monitorPortHealth(path: string): Observable<{
    path: string;
    isHealthy: boolean;
    issues: string[];
    metrics: PortPerformanceMetrics | undefined;
  }> {
    return timer(0, 5000).pipe(
      // Check every 5 seconds
      switchMap(() =>
        forkJoin({
          isConnected: from(this._serialAdapter.isPortConnected(path)),
          state: from(this._serialAdapter.getConnectionState(path)).pipe(catchError(() => of(null))),
        }),
      ),
      map(({ isConnected, state }) => {
        const issues: string[] = [];
        const metrics = this.getPortMetrics(path);

        if (!isConnected) {
          issues.push('Port not connected');
        }

        if (state?.lastError) {
          issues.push(`Last error: ${state.lastError}`);
        }

        if (metrics && metrics.errorCount > 10) {
          issues.push(`High error count: ${metrics.errorCount}`);
        }

        return {
          path,
          isHealthy: issues.length === 0,
          issues,
          metrics,
        };
      }),
      takeUntil(this._destroy$),
    );
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

    // Start performance tracking if enabled
    if (this._config.enablePerformanceTracking) {
      this._startPerformanceTracking();
    }

    this._logger.log('Port monitoring started with intervals:', {
      connection: this._config.connectionCheckInterval,
      health: this._config.healthCheckInterval,
      discovery: this._config.discoveryRefreshInterval,
      performance: this._config.enablePerformanceTracking,
    });
  }

  private _startConnectionMonitoring(): void {
    timer(0, this._config.connectionCheckInterval)
      .pipe(
        switchMap(() => from(this._serialAdapter.getConnectedPorts())),
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
        switchMap(() => this._createHealthStatus()),
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

  private _startPerformanceTracking(): void {
    timer(0, 10000)
      .pipe(
        // Track every 10 seconds
        switchMap(() => from(this._serialAdapter.getConnectedPorts())),
        mergeMap((connectedPorts) => from(connectedPorts).pipe(concatMap((path) => this._updatePortMetrics(path)))),
        takeUntil(this._destroy$),
      )
      .subscribe({
        error: (err) => this._logger.error('Performance tracking error:', err),
      });
  }

  private _updatePortMetrics(path: string): Observable<void> {
    return forkJoin({
      connectionTime: from(this._serialAdapter.getConnectionTime(path)),
      state: from(this._serialAdapter.getConnectionState(path)).pipe(catchError(() => of(null))),
    }).pipe(
      tap(({ connectionTime, state }) => {
        const metrics = this._performanceMetrics$.value;
        const existing = metrics.get(path);

        const updated: PortPerformanceMetrics = {
          path,
          bytesReceived: existing?.bytesReceived || 0,
          bytesSent: existing?.bytesSent || 0,
          errorCount: state?.lastError ? (existing?.errorCount || 0) + 1 : existing?.errorCount || 0,
          lastActivity: new Date(),
          connectionDuration: connectionTime ? Date.now() - connectionTime.getTime() : 0,
          reconnectCount: state?.reconnectAttempts || 0,
        };

        metrics.set(path, updated);
        this._performanceMetrics$.next(metrics);
      }),
      map(() => void 0),
      catchError((error) => {
        this._logger.debug(`Failed to update metrics for ${path}:`, error.message);
        return of(void 0);
      }),
    );
  }

  private _handleConnectionChange(currentPorts: string[]): void {
    const previousPorts = this._lastConnectedPorts;
    const added = currentPorts.filter((port) => !previousPorts.includes(port));
    const removed = previousPorts.filter((port) => !currentPorts.includes(port));

    if (added.length > 0 || removed.length > 0) {
      // Get port details for enhanced event
      const getPortDetails = (ports: string[]) => {
        return from(ports).pipe(
          concatMap((path) =>
            from(this._serialAdapter.getConnectionState(path)).pipe(
              map((state) => ({ path, state })),
              catchError((error) => of({ path, error: error.message })),
            ),
          ),
          map((results) => (Array.isArray(results) ? results : [results])),
        );
      };

      const event: ConnectionChangeEvent = {
        timestamp: new Date(),
        currentConnected: [...currentPorts],
        added,
        removed,
        totalConnected: currentPorts.length,
        eventType: added.length > 0 ? 'CONNECTED' : 'DISCONNECTED',
      };

      // Add port details for enhanced monitoring
      if (added.length > 0 || removed.length > 0) {
        getPortDetails([...added, ...removed]).subscribe({
          next: (details) => {
            event.portDetails = details;
            this._connectionEvents$.next(event);
          },
          error: () => {
            // Emit event without details if fetching fails
            this._connectionEvents$.next(event);
          },
        });
      } else {
        this._connectionEvents$.next(event);
      }

      if (this._config.enableEventLogging) {
        if (added.length > 0) {
          this._logger.log(`Ports connected: [${added.join(', ')}]`);
        }
        if (removed.length > 0) {
          this._logger.warn(`Ports disconnected: [${removed.join(', ')}]`);

          // Clean up metrics for removed ports
          const metrics = this._performanceMetrics$.value;
          removed.forEach((path) => metrics.delete(path));
          this._performanceMetrics$.next(metrics);
        }
      }
    }

    this._lastConnectedPorts = [...currentPorts];
  }

  private _refreshPortStatus(): Observable<any> {
    const startTime = Date.now();

    return forkJoin({
      available: this._portDiscovery.availablePorts$(),
      connected: from(this._serialAdapter.getConnectedPortsInfo()),
    }).pipe(
      map(({ available, connected }) => {
        // Track response time
        const responseTime = Date.now() - startTime;
        this._responseTimeSamples.push(responseTime);
        if (this._responseTimeSamples.length > 10) {
          this._responseTimeSamples.shift();
        }

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
        return of({
          availablePorts: [],
          connectedPorts: [],
          totalAvailable: 0,
          totalConnected: 0,
          unconnectedPorts: [],
        });
      }),
    );
  }

  private _createHealthStatus(): Observable<HealthStatus> {
    return from(this._serialAdapter.getConnectionStats()).pipe(
      map((stats) => {
        const issues: string[] = [];

        // Check for issues based on thresholds
        if (stats.failedPorts > this._config.alertThresholds.maxFailedPorts) {
          issues.push(`${stats.failedPorts} failed port connections (threshold: ${this._config.alertThresholds.maxFailedPorts})`);
        }

        if (stats.connectingPorts > 3) {
          issues.push(`${stats.connectingPorts} ports stuck connecting`);
        }

        const uptime = Date.now() - this._startTime;
        if (uptime > this._config.maxIdleTime && stats.openConnections === 0) {
          issues.push('No active connections for extended period');
        }

        // Calculate performance metrics
        const avgResponseTime =
          this._responseTimeSamples.length > 0
            ? this._responseTimeSamples.reduce((a, b) => a + b, 0) / this._responseTimeSamples.length
            : 0;

        const errorRate = stats.totalConnections > 0 ? stats.failedPorts / stats.totalConnections : 0;

        const uptimePercentage = uptime > 0 ? 1 - errorRate * 0.1 : 1;

        return {
          isHealthy: issues.length === 0 && errorRate < 1 - this._config.alertThresholds.minHealthScore,
          connectionStats: stats,
          systemUptime: uptime,
          lastUpdate: new Date(),
          issues,
          performance: {
            avgResponseTime,
            errorRate,
            uptime: uptimePercentage,
          },
        };
      }),
      catchError((error) => {
        this._logger.error('Failed to create health status:', error);
        return of(this._createInitialHealth());
      }),
    );
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
      performance: {
        avgResponseTime: 0,
        errorRate: 0,
        uptime: 1,
      },
    };
  }
}
