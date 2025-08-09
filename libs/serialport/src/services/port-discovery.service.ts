import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { DISCOVERY_CONFIG } from '@serialport/serialport.constants';
import { Observable, BehaviorSubject, Subject, timer, EMPTY, from, of } from 'rxjs';
import { map, switchMap, distinctUntilChanged, takeUntil, tap, catchError, debounceTime, mergeMap, concatMap } from 'rxjs/operators';

import { InjectSerialManager, ISerialAdapter, SerialOptions, SerialPortInfo, SerialPortState } from '../serial';

export type DiscoveryConfig = {
  enabled: boolean;
  scanInterval: number; // ms
  autoConnect: boolean;
  includeSystemPorts: boolean;
  excludePaths: string[];
  includeManufacturers: string[];
  excludeManufacturers: string[];
  serialOptions: SerialOptions;
};

export type ConnectedPort = {
  path: string;
  info: SerialPortInfo;
  state: SerialPortState;
  connectedAt: Date;
};

const defaultConfig: DiscoveryConfig = {
  enabled: true,
  scanInterval: 5000, // 5 seconds
  autoConnect: true,
  includeSystemPorts: false,
  excludePaths: [],
  includeManufacturers: [],
  excludeManufacturers: [],
  serialOptions: {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    autoOpen: true,
  },
};

@Injectable()
export class PortDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(PortDiscoveryService.name);
  private readonly _destroy$ = new Subject<void>();

  private readonly _availablePorts$ = new BehaviorSubject<SerialPortInfo[]>([]);
  private readonly _connectedPorts$ = new BehaviorSubject<Map<string, ConnectedPort>>(new Map());

  constructor(
    @Inject(DISCOVERY_CONFIG) private readonly _configs: DiscoveryConfig,
    @InjectSerialManager() private readonly _serialAdapter: ISerialAdapter,
  ) {
    this._configs = { ...defaultConfig, ...this._configs };
  }

  public onModuleInit(): void {
    this._logger.log('Initializing Auto Discovery Serialport Service');
    if (this._configs.enabled) {
      this._startDiscovery();
    }
  }

  public onModuleDestroy(): void {
    this._logger.log('Shutting down Auto Discovery Serialport Service');
    this._destroy$.next();
    this._destroy$.complete();
  }

  public availablePorts$(): Observable<SerialPortInfo[]> {
    return this._availablePorts$.asObservable();
  }

  public connectedPorts$(): Observable<ConnectedPort[]> {
    return this._connectedPorts$.pipe(map((portMap) => Array.from(portMap.values())));
  }

  public getConnectedPort(path: string): ConnectedPort | undefined {
    return this._connectedPorts$.value.get(path);
  }

  public disconnectFromPort(path: string): Observable<void> {
    return from(this._serialAdapter.close(path)).pipe(
      tap(() => {
        const currentPorts = this._connectedPorts$.value;
        currentPorts.delete(path);
        this._connectedPorts$.next(currentPorts);
        this._logger.log(`Disconnected from port: ${path}`);
      }),
      catchError((error) => {
        this._logger.error(`Failed to disconnect from port ${path}:`, error);
        throw error;
      }),
    );
  }

  public connectToPort(path: string, options?: SerialOptions): Observable<SerialPortState> {
    const connectOptions = { ...this._configs.serialOptions, ...options };

    return from(this._serialAdapter.open(path, connectOptions)).pipe(
      tap((state) => {
        if (state.isOpen) {
          // Get port info for the connected port
          this._updateConnectedPort(path, state);
          this._logger.log(`Connected to port: ${path}`);
        }
      }),
      catchError((error) => {
        this._logger.error(`Failed to connect to port ${path}:`, error);
        throw error;
      }),
    );
  }

  public refreshDiscover(): Observable<SerialPortInfo[]> {
    return this._discoverPorts();
  }

  public getPortConnectionState(path: string): Observable<SerialPortState> {
    return from(this._serialAdapter.getConnectionState(path)).pipe(
      catchError((error) => {
        this._logger.error(`Failed to get connection state for ${path}:`, error);
        throw error;
      }),
    );
  }

  public isPortConnected(path: string): Observable<boolean> {
    return from(this._serialAdapter.isPortConnected(path)).pipe(
      catchError((error) => {
        this._logger.error(`Failed to check if port ${path} is connected:`, error);
        return of(false);
      }),
    );
  }

  private _startDiscovery(): void {
    // Start periodic port scanning
    from([this._configs])
      .pipe(
        distinctUntilChanged((a, b) => a.enabled === b.enabled && a.scanInterval === b.scanInterval),
        switchMap((config) => {
          if (!config.enabled) {
            this._logger.log('Auto discovery disabled');
            return EMPTY;
          }

          this._logger.log(`Starting auto discovery with ${config.scanInterval}ms interval`);
          return timer(0, config.scanInterval).pipe(
            switchMap(() => this._discoverPorts()),
            debounceTime(1000), // Debounce rapid changes
            takeUntil(this._destroy$),
          );
        }),
        takeUntil(this._destroy$),
      )
      .subscribe({
        error: (error) => {
          this._logger.error('Discovery stream error:', error);
        },
      });
  }

  private _discoverPorts(): Observable<SerialPortInfo[]> {
    return from(this._serialAdapter.listPorts()).pipe(
      map((ports) => this._filterPorts(ports)),
      tap((filteredPorts) => {
        const currentPorts = this._availablePorts$.value;
        const newPortPaths = filteredPorts.map((p) => p.path);
        const currentPortPaths = currentPorts.map((p) => p.path);

        // Log changes
        const addedPorts = newPortPaths.filter((p) => !currentPortPaths.includes(p));
        const removedPorts = currentPortPaths.filter((p) => !newPortPaths.includes(p));

        if (addedPorts.length > 0) {
          this._logger.log(`New ports detected: [${addedPorts.join(', ')}]`);

          // Auto-connect to new ports if enabled
          if (this._configs.autoConnect) {
            this._autoConnectToPorts(addedPorts, filteredPorts);
          }
        }

        if (removedPorts.length > 0) {
          this._logger.log(`Ports removed: [${removedPorts.join(', ')}]`);
          this._handleRemovedPorts(removedPorts);
        }

        this._availablePorts$.next(filteredPorts);
      }),
      catchError((error) => {
        this._logger.error('Failed to discover ports:', error);
        return of([]); // Return empty array instead of EMPTY to continue the stream
      }),
    );
  }

  private _autoConnectToPorts(addedPorts: string[], allPorts: SerialPortInfo[]): void {
    addedPorts.forEach((path) => {
      const portInfo = allPorts.find((p) => p.path === path);
      if (portInfo) {
        this._logger.log(`Auto-connecting to port: ${path}`);

        // Auto-connect with a small delay to avoid overwhelming the system
        timer(500)
          .pipe(
            switchMap(() => this.connectToPort(path)),
            takeUntil(this._destroy$),
          )
          .subscribe({
            next: (state) => {
              if (state.isOpen) {
                this._logger.log(`Auto-connected successfully to: ${path}`);
              }
            },
            error: (error) => {
              this._logger.warn(`Auto-connect failed for ${path}:`, error.message);
            },
          });
      }
    });
  }

  private _updateConnectedPort(path: string, state: SerialPortState): void {
    // Get port info from available ports
    const portInfo = this._availablePorts$.value.find((p) => p.path === path);
    if (portInfo) {
      const connectedPort: ConnectedPort = {
        path,
        info: portInfo,
        state,
        connectedAt: new Date(),
      };

      const currentConnected = this._connectedPorts$.value;
      currentConnected.set(path, connectedPort);
      this._connectedPorts$.next(currentConnected);
    }
  }

  private _filterPorts(ports: SerialPortInfo[]): SerialPortInfo[] {
    const config = this._configs;

    return ports.filter((port) => {
      // Exclude system ports if configured
      if (!config.includeSystemPorts && this._isSystemPort(port)) {
        return false;
      }

      // Check exclude paths (regex patterns)
      if (config.excludePaths.some((pattern) => new RegExp(pattern).test(port.path))) {
        return false;
      }

      // Check manufacturer filters
      if (config.includeManufacturers.length > 0) {
        if (!port.manufacturer || !config.includeManufacturers.includes(port.manufacturer)) {
          return false;
        }
      }

      if (config.excludeManufacturers.length > 0) {
        if (port.manufacturer && config.excludeManufacturers.includes(port.manufacturer)) {
          return false;
        }
      }

      return true;
    });
  }

  private _isSystemPort(port: SerialPortInfo): boolean {
    const systemPatterns = [
      /\/dev\/tty\d+$/,
      /\/dev\/cu\.Bluetooth/,
      /COM\d+$/, // Windows system ports
      /\/dev\/console$/,
      /\/dev\/ttyS\d+$/, // Standard serial ports
    ];

    return systemPatterns.some((pattern) => pattern.test(port.path));
  }

  private _handleRemovedPorts(removedPorts: string[]): void {
    const currentConnected = this._connectedPorts$.value;
    let hasChanges = false;

    removedPorts.forEach((path) => {
      if (currentConnected.has(path)) {
        currentConnected.delete(path);
        hasChanges = true;
        this._logger.log(`Port ${path} was disconnected (device removed)`);

        // Also attempt to clean up the connection in the adapter
        from(this._serialAdapter.close(path))
          .pipe(takeUntil(this._destroy$))
          .subscribe({
            next: () => this._logger.debug(`Cleaned up connection for removed port: ${path}`),
            error: (error) => this._logger.debug(`Port ${path} was already closed or cleanup failed:`, error.message),
          });
      }
    });

    if (hasChanges) {
      this._connectedPorts$.next(currentConnected);
    }
  }

  // Additional utility methods for monitoring connection states
  public monitorConnectionStates(): Observable<Map<string, SerialPortState>> {
    return timer(0, 2000).pipe(
      // Check every 2 seconds
      switchMap(() => {
        const connectedPaths = Array.from(this._connectedPorts$.value.keys());
        if (connectedPaths.length === 0) {
          return of(new Map<string, SerialPortState>());
        }

        return from(connectedPaths).pipe(
          concatMap((path) =>
            from(this._serialAdapter.getConnectionState(path)).pipe(
              map((state) => ({ path, state })),
              catchError((error) => {
                this._logger.debug(`Failed to get state for ${path}:`, error.message);
                return of({ path, state: null });
              }),
            ),
          ),
          map((results) => {
            const stateMap = new Map<string, SerialPortState>();
            if (Array.isArray(results)) {
              results.forEach((result) => {
                if (result.state) {
                  stateMap.set(result.path, result.state);
                }
              });
            } else if (results && results.state) {
              stateMap.set(results.path, results.state);
            }
            return stateMap;
          }),
        );
      }),
      tap((stateMap) => {
        // Update connected ports with latest states
        const currentConnected = this._connectedPorts$.value;
        let hasChanges = false;

        stateMap.forEach((state, path) => {
          const connectedPort = currentConnected.get(path);
          if (connectedPort && JSON.stringify(connectedPort.state) !== JSON.stringify(state)) {
            connectedPort.state = state;
            hasChanges = true;
          }
        });

        if (hasChanges) {
          this._connectedPorts$.next(currentConnected);
        }
      }),
      takeUntil(this._destroy$),
    );
  }

  // Get all connection statistics
  public getConnectionStats(): Observable<{
    totalAvailable: number;
    totalConnected: number;
    connectedPaths: string[];
    availablePaths: string[];
  }> {
    return this._availablePorts$.pipe(
      map((availablePorts) => {
        const connectedPorts = Array.from(this._connectedPorts$.value.keys());
        return {
          totalAvailable: availablePorts.length,
          totalConnected: connectedPorts.length,
          connectedPaths: connectedPorts,
          availablePaths: availablePorts.map((p) => p.path),
        };
      }),
    );
  }
}
