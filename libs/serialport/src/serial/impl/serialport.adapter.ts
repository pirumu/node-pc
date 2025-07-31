import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { asyncScheduler, BehaviorSubject, from, lastValueFrom, Observable, of, scheduled, Subject, throwError, timer } from 'rxjs';
import {
  buffer,
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  mergeMap,
  scan,
  shareReplay,
  takeUntil,
  tap,
  toArray,
} from 'rxjs/operators';
import { ByteLengthParser, DelimiterParser, ReadlineParser, SerialPort } from 'serialport';

import { DISCOVERY_CONFIG } from '../../serialport.constants';
import { DiscoveryConfig } from '../../services/port-discovery.service';
import {
  BufferStrategy,
  ConnectedPortInfo,
  ConnectionStats,
  ConnectionSummary,
  ISerialAdapter,
  ParserConfig,
  SerialConnection,
  SerialOptions,
  SerialPortInfo,
  SerialPortState,
} from '../serial-adapter.interface';

import { SerialPortHandler, retryStrategy, exponentialStrategy, intervalStrategy } from './serial-port.helper';

export const DEFAULT_OPTIONS: SerialOptions = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  reconnectStrategy: 'retry',
  maxReconnectAttempts: 5,
  retryDelay: 1000,
  parser: { type: 'raw' },
  bufferStrategy: { type: 'none' },
};

@Injectable()
export class SerialPortAdapter implements ISerialAdapter, OnModuleDestroy {
  private readonly _logger = new Logger(SerialPortAdapter.name);
  private readonly _connectionTimes = new Map<string, Date>();
  private readonly _connections = new Map<string, SerialConnection>();
  private readonly _destroy$ = new Subject<void>();
  private readonly _defaultOptions: SerialOptions = DEFAULT_OPTIONS;

  constructor(@Inject(DISCOVERY_CONFIG) private readonly _configs: DiscoveryConfig) {
    this._defaultOptions = {
      ...this._defaultOptions,
      ...this._configs.serialOptions,
    };
  }

  public async onModuleDestroy(): Promise<void> {
    this._logger.log('Cleaning up SerialPortAdapter...');
    this._connectionTimes.clear();
    await this._cleanup();
  }

  private async _cleanup(): Promise<void> {
    this._destroy$.next();
    this._destroy$.complete();
    try {
      await lastValueFrom(
        this.dispose().pipe(
          catchError((err) => {
            this._logger.error(`Dispose failed during cleanup:`, err);
            return from(Array.from(this._connections.keys())).pipe(
              mergeMap((path) =>
                this.close(path).pipe(
                  catchError((individualErr) => {
                    this._logger.error(`Error closing individual port ${path} during cleanup:`, individualErr);
                    return of(undefined);
                  }),
                ),
              ),
              toArray(),
              map(() => undefined),
            );
          }),
        ),
      );
      this._logger.log('SerialPortAdapter cleanup completed');
    } catch (error) {
      this._logger.error('Error during SerialPortAdapter cleanup:', error);
    }
  }

  private _createParser(port: SerialPort, config: ParserConfig): any {
    switch (config.type) {
      case 'readline':
        return port.pipe(new ReadlineParser(config.options || { delimiter: '\r\n' }));
      case 'bytelength':
        return port.pipe(new ByteLengthParser({ length: config.options?.length || 8 }));
      case 'delimiter':
        return port.pipe(new DelimiterParser({ delimiter: config.options?.delimiter || '\n' }));
      case 'raw':
      default:
        return port;
    }
  }

  private _createBufferStrategy(source$: Observable<Buffer>, strategy: BufferStrategy): Observable<Buffer> {
    switch (strategy.type) {
      case 'none':
        return source$;

      case 'time':
        return source$.pipe(
          buffer(timer(strategy.timeMs || 100)),
          filter((chunks) => chunks.length > 0),
          map((chunks) => Buffer.concat(chunks)),
        );

      case 'size':
        return source$.pipe(
          scan(
            (acc: { buffer: Buffer; size: number }, chunk: Buffer) => {
              const newBuffer = Buffer.concat([acc.buffer, chunk]);
              return { buffer: newBuffer, size: acc.size + chunk.length };
            },
            { buffer: Buffer.alloc(0), size: 0 },
          ),
          filter((state) => state.size >= (strategy.size || 1024)),
          map((state) => state.buffer),
        );

      case 'delimiter':
        const delimiter = strategy.delimiter || Buffer.from([0x00]);
        const maxBufferSize = strategy.maxBufferSize || 1024 * 1024;

        return source$.pipe(
          scan(
            (acc, chunk) => {
              const combined = Buffer.concat([acc.buffer, chunk]);

              if (combined.length > maxBufferSize) {
                this._logger.warn(`Delimiter buffer exceeded max size (${maxBufferSize} bytes). Flushing buffer.`);
                return { buffer: Buffer.alloc(0), emit$: acc.emit$ };
              }

              const chunks: Buffer[] = [];
              let lastIndex = 0;
              let foundIndex = -1;

              while ((foundIndex = combined.indexOf(delimiter, lastIndex)) !== -1) {
                chunks.push(combined.subarray(lastIndex, foundIndex));
                lastIndex = foundIndex + delimiter.length;
              }

              chunks.forEach((completeChunk) => {
                if (completeChunk.length > 0) {
                  acc.emit$.next(completeChunk);
                }
              });

              return {
                buffer: combined.subarray(lastIndex),
                emit$: acc.emit$,
              };
            },
            {
              buffer: Buffer.alloc(0),
              emit$: new Subject<Buffer>(),
            },
          ),
          mergeMap((state) => state.emit$),
        );

      case 'combined':
        return source$.pipe(
          buffer(
            timer(strategy.timeMs || 100).pipe(
              takeUntil(
                source$.pipe(
                  scan((acc, chunk) => acc + chunk.length, 0),
                  filter((size) => size >= (strategy.size || 1024)),
                ),
              ),
            ),
          ),
          filter((chunks) => chunks.length > 0),
          map((chunks) => Buffer.concat(chunks)),
        );

      default:
        return source$;
    }
  }

  public listPorts(): Observable<SerialPortInfo[]> {
    return from(SerialPort.list()).pipe(
      map((ports) =>
        ports
          .map((p) => ({
            path: p.path,
            manufacturer: p.manufacturer,
            serialNumber: p.serialNumber,
            vendorId: p.vendorId,
            productId: p.productId,
          }))
          .filter((p) => !!p.manufacturer),
      ),
      takeUntil(this._destroy$),
    );
  }

  public open(path: string, options: SerialOptions): Observable<SerialPortState> {
    const existingConnection = this._connections.get(path);
    if (existingConnection) {
      this._logger.log(`Connection for ${path} already exists. Returning existing state stream.`);
      return existingConnection.state$.pipe(
        distinctUntilChanged((prev, curr) => prev.isOpen === curr.isOpen && prev.isConnecting === curr.isConnecting),
        takeUntil(this._destroy$),
      );
    }

    const connection = this._createConnection(path, options);
    this._connections.set(path, connection);

    this._establishConnectionWithStrategy(connection).subscribe({
      error: (err) => {
        this._logger.error(`Unhandled error in connection strategy for ${path}:`, err);
        const finalState: SerialPortState = {
          path,
          isOpen: false,
          isConnecting: false,
          lastError: err.message,
          reconnectAttempts: connection.state$.value.reconnectAttempts,
        };
        connection.state$.next(finalState);
      },
    });

    return connection.state$.pipe(
      tap((state) => {
        if (state.isOpen && !this._connectionTimes.has(path)) {
          this._connectionTimes.set(path, new Date());
        }
      }),
      distinctUntilChanged((prev, curr) => prev.isOpen === curr.isOpen && prev.isConnecting === curr.isConnecting),
      shareReplay(1),
      takeUntil(this._destroy$),
    );
  }

  private _createConnection(path: string, options: SerialOptions): SerialConnection {
    const mergedOptions = { ...this._defaultOptions, ...options };
    const rawData$ = new Subject<Buffer>();
    const connection: SerialConnection = {
      path,
      state$: new BehaviorSubject<SerialPortState>({
        path,
        isOpen: false,
        isConnecting: false,
        reconnectAttempts: 0,
      }),
      data$: new Subject<Buffer>(),
      rawData$,
      error$: new Subject<Error>(),
      destroy$: new Subject<void>(),
      options: mergedOptions,
      bufferedData$: this._createBufferStrategy(rawData$, mergedOptions.bufferStrategy || { type: 'none' }),
    };

    connection.bufferedData$.pipe(takeUntil(connection.destroy$)).subscribe({
      next: (data) => connection.data$.next(data),
      error: (err) => connection.error$.next(err),
    });

    return connection;
  }

  private _establishConnectionWithStrategy(connection: SerialConnection): Observable<SerialPortState> {
    const { path, options } = connection;
    const strategy = options.reconnectStrategy || 'retry';
    const retryDelay = options.retryDelay || 1000;
    const maxAttempts = options.maxReconnectAttempts ?? 5;

    const connection$ = this._createAndSetupPort(connection);

    // Use helper functions for retry strategies
    switch (strategy) {
      case 'retry':
        return retryStrategy(connection$, path, retryDelay, maxAttempts, this._logger);

      case 'exponential':
        return exponentialStrategy(connection$, path, retryDelay, maxAttempts, this._logger);

      case 'interval':
        return intervalStrategy(connection$, path, retryDelay, maxAttempts, this._logger).pipe(takeUntil(connection.destroy$));

      default:
        return connection$;
    }
  }

  private _createAndSetupPort(connection: SerialConnection): Observable<SerialPortState> {
    return new Observable<SerialPortState>((subscriber) => {
      const { path, options } = connection;

      const updateState = (updates: Partial<SerialPortState>): SerialPortState => {
        const currentState = connection.state$.value;
        const newState = { ...currentState, ...updates };
        connection.state$.next(newState);
        return newState;
      };

      updateState({
        isConnecting: true,
        reconnectAttempts: connection.state$.value.reconnectAttempts + 1,
      });

      try {
        const handler = new SerialPortHandler(path, options, this._logger, this._createParser.bind(this));

        connection.port = handler.port;
        connection.parser = handler.parser;

        handler.rawData$.pipe(takeUntil(connection.destroy$)).subscribe({
          next: (data) => connection.rawData$.next(data),
          error: (err) => connection.error$.next(err),
        });

        handler.error$.pipe(takeUntil(connection.destroy$)).subscribe({
          next: (err) => {
            connection.error$.next(err);
            updateState({ lastError: err.message });
          },
        });

        handler
          .open()
          .then(() => {
            const state = updateState({
              isOpen: true,
              isConnecting: false,
              reconnectAttempts: 0,
              lastError: undefined,
            });
            subscriber.next(state);
            subscriber.complete();
          })
          .catch((err) => {
            updateState({ isConnecting: false, lastError: err.message });
            subscriber.error(err);
          });

        return () => {
          handler.destroy();
        };
      } catch (error) {
        updateState({ isConnecting: false, lastError: (error as Error).message });
        subscriber.error(error);
      }
    });
  }
  public write(path: string, data: string | Buffer): Observable<{ status: boolean }> {
    const connection = this._connections.get(path);
    if (!connection?.port?.isOpen) {
      return throwError(() => new Error(`Port ${path} is not open or does not exist.`));
    }
    return new Observable((subscriber) => {
      connection.port!.write(data, (err) => {
        if (err) {
          this._logger.error(`Write error on ${path}:`, err);
          connection.error$.next(err);
          subscriber.error(err);
        } else {
          subscriber.next({ status: true });
          subscriber.complete();
        }
      });
    });
  }

  public onData(path: string): Observable<Buffer> {
    const connection = this._connections.get(path);
    if (!connection) {
      return throwError(() => new Error(`Connection ${path} not found`));
    }
    return connection.data$.pipe(takeUntil(connection.destroy$));
  }

  public onError(path: string): Observable<Error> {
    const connection = this._connections.get(path);
    if (!connection) {
      return throwError(() => new Error(`Connection ${path} not found`));
    }
    return connection.error$.pipe(takeUntil(connection.destroy$));
  }

  public onConnectionState(path: string): Observable<SerialPortState> {
    const connection = this._connections.get(path);
    if (!connection) {
      return throwError(() => new Error(`Connection ${path} not found`));
    }
    return connection.state$.pipe(takeUntil(this._destroy$));
  }

  public isOpen(path: string): Observable<boolean> {
    return this.onConnectionState(path).pipe(map((state) => state.isOpen));
  }

  public close(path: string): Observable<void> {
    const connection = this._connections.get(path);
    if (!connection) {
      return of(undefined);
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
    );
  }

  public dispose(): Observable<void> {
    const closeAll$ = from(Array.from(this._connections.keys())).pipe(
      mergeMap((path) =>
        this.close(path).pipe(
          catchError((err) => {
            this._logger.error(`Error disconnecting from ${path} during dispose:`, err);
            return of(null);
          }),
        ),
      ),
      toArray(),
      map(() => undefined),
    );

    return closeAll$.pipe(
      tap(() => {
        this._destroy$.next();
        this._destroy$.complete();
      }),
    );
  }

  private _cleanupConnection(path: string): void {
    const connection = this._connections.get(path);
    if (connection) {
      connection.state$.complete();
      connection.data$.complete();
      connection.error$.complete();
      connection.rawData$.complete();
      this._connections.delete(path);
    }
    this._connectionTimes.delete(path);
    this._logger.debug(`Connection ${path} cleaned up`);
  }

  public getConnectedPorts(): string[] {
    return Array.from(this._connections.values())
      .filter((c) => c.state$.value.isOpen)
      .map((c) => c.path);
  }

  public getConnectedPortsInfo(): Observable<ConnectedPortInfo[]> {
    const connectedPaths = this.getConnectedPorts();
    if (connectedPaths.length === 0) {
      return scheduled([], asyncScheduler);
    }

    return this.listPorts().pipe(
      map((allPorts) =>
        connectedPaths
          .map((path) => {
            const connection = this._connections.get(path);
            const portInfo = allPorts.find((p) => p.path === path);
            return {
              path,
              info: portInfo,
              state: connection?.state$.value,
              options: connection?.options,
              connectedAt: this._connectionTimes.get(path),
            } as ConnectedPortInfo;
          })
          .filter((p): p is ConnectedPortInfo => !!p),
      ),
    );
  }

  public isPortConnected(path: string): boolean {
    return this._connections.get(path)?.state$.value.isOpen === true;
  }

  public getPortConnectionState(path: string): SerialPortState | null {
    return this._connections.get(path)?.state$.value || null;
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
}
