import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Observable, BehaviorSubject, Subject, timer, EMPTY, from } from 'rxjs';
import { map, switchMap, distinctUntilChanged, takeUntil, tap, catchError, debounceTime } from 'rxjs/operators';

import { InjectSerialManager, ISerialAdapter, SerialOptions, SerialPortInfo, SerialPortState } from '../serial';
import { DISCOVERY_CONFIG } from '../serialport.constants';

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
    this._startDiscovery();
  }

  public onModuleDestroy(): void {
    this._logger.log('Shutting down AAuto Discovery Serialport Service');
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
    return this._serialAdapter.close(path).pipe(
      tap(() => {
        const currentPorts = this._connectedPorts$.value;
        currentPorts.delete(path);
        this._connectedPorts$.next(currentPorts);
        this._logger.log(`Disconnected from port: ${path}`);
      }),
    );
  }

  public refreshDiscover(): Observable<SerialPortInfo[]> {
    return this._discoverPorts();
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
      .subscribe();
  }

  private _discoverPorts(): Observable<SerialPortInfo[]> {
    return this._serialAdapter.listPorts().pipe(
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
        }
        if (removedPorts.length > 0) {
          this._logger.log(`Ports removed: [${removedPorts.join(', ')}]`);
          this._handleRemovedPorts(removedPorts);
        }

        this._availablePorts$.next(filteredPorts);
      }),
      catchError((error) => {
        this._logger.error('Failed to discover ports:', error);
        return EMPTY;
      }),
    );
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
      }
    });

    if (hasChanges) {
      this._connectedPorts$.next(currentConnected);
    }
  }
}
