import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DiscoveryConfig } from '@serialport';
import { DISCOVERY_CONFIG } from '@serialport/serialport.constants';
import { Observable, BehaviorSubject, Subject, from, EMPTY, throwError, timer, of, lastValueFrom } from 'rxjs';
import { map, catchError, takeUntil, switchMap, tap, shareReplay, mergeMap, toArray, finalize, retry } from 'rxjs/operators';
import { SerialPort } from 'serialport';

import { AccumulatingParser } from '../parsers';
import {
  ConnectedPortInfo,
  ConnectionStats,
  ConnectionSummary,
  ISerialAdapter,
  SerialConnection,
  SerialOptions,
  SerialPortInfo,
  SerialPortState,
} from '../serial-adapter.interface';

@Injectable()
export class SerialPortAdapter implements ISerialAdapter, OnModuleDestroy {
  private readonly _logger = new Logger(SerialPortAdapter.name);
  private readonly _connections = new Map<string, SerialConnection>();
  private readonly _connectionTimes = new Map<string, Date>();
  private readonly _destroy$ = new Subject<void>();

  private readonly _defaultOptions: SerialOptions = {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    autoOpen: true,
    reconnectInterval: 1000,
    maxReconnectAttempts: 5,
    retryDelay: 1000,
    maxRetries: 3,
  };

  constructor(@Inject(DISCOVERY_CONFIG) private readonly _configs: DiscoveryConfig) {
    this._defaultOptions = {
      ...this._defaultOptions,
      ...this._configs.serialOptions,
    };
  }

  public async onModuleDestroy(): Promise<void> {
    this._logger.log('Cleaning up SerialPortAdapter...');

    // Clear all tracking data
    this._connectionTimes.clear();

    // Dispose all connections
    return this._cleanup();
  }

  private async _cleanup(): Promise<void> {
    try {
      await lastValueFrom(this.dispose());
      this._logger.log('SerialPortAdapter cleanup completed');
    } catch (error) {
      this._logger.error('Error during SerialPortAdapter cleanup:', error);
    }
  }

  public listPorts(): Observable<SerialPortInfo[]> {
    return new Observable<SerialPortInfo[]>((subscriber) => {
      SerialPort.list()
        .then((ports) => {
          const result = ports
            .map((p) => ({
              path: p.path,
              manufacturer: p.manufacturer,
              serialNumber: p.serialNumber,
              vendorId: p.vendorId,
              productId: p.productId,
            }))
            .filter((p) => !!p.manufacturer);
          subscriber.next(result);
          subscriber.complete();
        })
        .catch((err) => subscriber.error(err));
    }).pipe(takeUntil(this._destroy$));
  }

  public open(path: string, options: SerialOptions): Observable<SerialPortState> {
    if (this._connections.has(path)) {
      return this._connections.get(path)!.state$.pipe(takeUntil(this._destroy$));
    }

    const connection = this._createConnection(path, options);
    this._connections.set(path, connection);

    return this._connectWithRetry(path, connection).pipe(
      tap((state) => {
        if (state.isOpen) {
          this._connectionTimes.set(path, new Date()); // Track connection time
        }
      }),
      shareReplay(1),
      takeUntil(this._destroy$),
    );
  }

  public write(path: string, data: string | Buffer): Observable<void> {
    const connection = this._connections.get(path);
    if (!connection || !connection.port) {
      return throwError(() => new Error(`Port ${path} not open`));
    }

    return new Observable<void>((subscriber) => {
      const writeData = typeof data === 'string' ? Buffer.from(data) : data;

      connection.port!.write(writeData, (err) => {
        if (err) {
          subscriber.error(err);
        } else {
          subscriber.next();
          subscriber.complete();
        }
      });
    }).pipe(takeUntil(this._destroy$));
  }

  public onData(path: string): Observable<Buffer> {
    const connection = this._connections.get(path);
    if (!connection) {
      return throwError(() => new Error(`Connection ${path} not found`));
    }

    return connection.data$.pipe(takeUntil(this._destroy$));
  }

  public onError(path: string): Observable<Error> {
    const connection = this._connections.get(path);
    if (!connection) {
      return throwError(() => new Error(`Connection ${path} not found`));
    }

    return connection.error$.pipe(takeUntil(this._destroy$));
  }

  public onConnectionState(path: string): Observable<SerialPortState> {
    const connection = this._connections.get(path);
    if (!connection) {
      return throwError(() => new Error(`Connection ${path} not found`));
    }

    return connection.state$.pipe(takeUntil(this._destroy$));
  }

  public isOpen(path: string): Observable<boolean> {
    const connection = this._connections.get(path);
    if (!connection) {
      return throwError(() => new Error(`Connection ${path} not found`));
    }

    return connection.state$.pipe(
      map((state) => state.isOpen),
      takeUntil(this._destroy$),
    );
  }

  public close(path: string): Observable<void> {
    const connection = this._connections.get(path);
    if (!connection) {
      return EMPTY;
    }

    return new Observable<void>((subscriber) => {
      connection.destroy$.next();
      connection.destroy$.complete();

      if (connection.port && connection.port.isOpen) {
        connection.port.close((err) => {
          if (err) {
            this._logger.error(`Error closing port ${path}:`, err);
            subscriber.error(err);
          } else {
            subscriber.next();
            subscriber.complete();
          }
        });
      } else {
        subscriber.next();
        subscriber.complete();
      }
    }).pipe(
      finalize(() => {
        this._cleanupConnection(path);
      }),
      takeUntil(this._destroy$),
    );
  }

  public dispose(): Observable<void> {
    const paths = Array.from(this._connections.keys());

    return from(paths).pipe(
      mergeMap((path) =>
        this.close(path).pipe(
          catchError((err) => {
            this._logger.error(`Error disconnecting from ${path}:`, err);
            return EMPTY;
          }),
        ),
      ),
      toArray(),
      tap(() => {
        this._destroy$.next();
        this._destroy$.complete();
      }),
      map(() => void 0),
    );
  }

  public getConnectedPorts(): string[] {
    return Array.from(this._connections.keys()).filter((path) => {
      const connection = this._connections.get(path);
      return connection?.state$.value.isOpen === true;
    });
  }

  public getConnectedPortsInfo(): Observable<ConnectedPortInfo[]> {
    const connectedPaths = this.getConnectedPorts();

    if (connectedPaths.length === 0) {
      return of([]);
    }

    return this.listPorts().pipe(
      map((allPorts) => {
        return connectedPaths
          .map((path) => {
            const connection = this._connections.get(path);
            const portInfo = allPorts.find((p) => p.path === path);

            return {
              path,
              info: portInfo,
              state: connection?.state$.value,
              options: connection?.options,
              connectedAt: this._connectionTimes.get(path),
            };
          })
          .filter(Boolean) as ConnectedPortInfo[];
      }),
      takeUntil(this._destroy$), // Prevent memory leak
    );
  }

  public isPortConnected(path: string): boolean {
    const connection = this._connections.get(path);
    return connection?.state$.value.isOpen === true;
  }

  public getPortConnectionState(path: string): SerialPortState | null {
    const connection = this._connections.get(path);
    return connection ? connection.state$.value : null;
  }

  public getAllConnections(): ConnectionSummary[] {
    return Array.from(this._connections.entries()).map(([path, connection]) => ({
      path,
      state: connection.state$.value,
      options: connection.options,
    }));
  }

  public getConnectionTime(path: string): Date | undefined {
    return this._connectionTimes.get(path);
  }

  public getConnectionStats(): ConnectionStats {
    const allConnections = this.getAllConnections();

    return {
      totalConnections: allConnections.length,
      openConnections: allConnections.filter((c) => c.state.isOpen).length,
      connectingPorts: allConnections.filter((c) => c.state.isConnecting).length,
      failedPorts: allConnections.filter((c) => !c.state.isOpen && !c.state.isConnecting).length,
    };
  }

  private _createConnection(path: string, options: SerialOptions): SerialConnection {
    const defaultOptions: SerialOptions = {
      ...this._defaultOptions,
      ...options,
    };

    return {
      state$: new BehaviorSubject<SerialPortState>({
        path,
        isOpen: false,
        isConnecting: false,
        reconnectAttempts: 0,
      }),
      data$: new Subject<Buffer>(),
      error$: new Subject<Error>(),
      destroy$: new Subject<void>(),
      options: defaultOptions,
    };
  }

  private _cleanupConnection(path: string): void {
    const connection = this._connections.get(path);
    if (connection) {
      connection.state$.complete();
      connection.data$.complete();
      connection.error$.complete();
      this._connections.delete(path);
    }
    this._connectionTimes.delete(path);
  }

  private _connectWithRetry(path: string, connection: SerialConnection): Observable<SerialPortState> {
    return this._establishConnection(path, connection).pipe(
      retry({
        delay: (errors) =>
          errors.pipe(
            tap((err: Error) => {
              const currentState = connection.state$.value;
              connection.state$.next({
                ...currentState,
                isConnecting: true,
                reconnectAttempts: currentState.reconnectAttempts + 1,
                lastError: err,
              });
            }),
            switchMap((_, index) => {
              const maxAttempts = connection.options.maxReconnectAttempts || 5;
              if (index >= maxAttempts) {
                return throwError(() => new Error(`Max reconnect attempts (${maxAttempts}) exceeded`));
              }
              const retryDelay = connection.options.retryDelay || 1000;
              return timer(retryDelay);
            }),
            takeUntil(connection.destroy$),
          ),
      }),
      catchError((err) => {
        const finalState: SerialPortState = {
          path,
          isOpen: false,
          isConnecting: false,
          lastError: err.message,
          reconnectAttempts: connection.options.maxReconnectAttempts || 3,
        };
        connection.state$.next(finalState);
        return throwError(() => err);
      }),
      takeUntil(connection.destroy$),
    );
  }

  private _establishConnection(path: string, connection: SerialConnection): Observable<SerialPortState> {
    return new Observable<SerialPortState>((subscriber) => {
      const { options } = connection;

      const port = new SerialPort({
        path,
        baudRate: options.baudRate,
        dataBits: options.dataBits ?? 8,
        stopBits: options.stopBits ?? 1,
        parity: options.parity ?? 'none',
        autoOpen: options.autoOpen ?? true,
      });

      const parser = port.pipe(new AccumulatingParser({ maxSize: 10240 }));

      connection.port = port;
      connection.parser = parser;

      const initialState: SerialPortState = {
        path,
        isOpen: false,
        isConnecting: true,
        reconnectAttempts: 0,
      };

      connection.state$.next(initialState);

      const openHandler = () => {
        const state: SerialPortState = {
          path,
          isOpen: true,
          isConnecting: false,
          reconnectAttempts: 0,
        };
        connection.state$.next(state);
        subscriber.next(state);
      };

      const errorHandler = (err: Error) => {
        connection.error$.next(err);
        subscriber.error(err);
      };

      const closeHandler = () => {
        const state: SerialPortState = {
          path,
          isOpen: false,
          isConnecting: false,
          reconnectAttempts: connection.state$.value.reconnectAttempts,
        };
        connection.state$.next(state);
        subscriber.error(new Error(`PortClosedUnexpectedly: Port ${path} was closed.`));
      };

      const dataHandler = (data: Buffer) => {
        connection.data$.next(data);
      };

      port.on('open', openHandler);
      port.on('error', errorHandler);
      port.on('close', closeHandler);
      parser.on('data', dataHandler);

      return () => {
        port.removeListener('open', openHandler);
        port.removeListener('error', errorHandler);
        port.removeListener('close', closeHandler);
        parser.removeListener('data', dataHandler);

        if (port.isOpen) {
          port.close();
        }
      };
    }).pipe(takeUntil(connection.destroy$));
  }
}
