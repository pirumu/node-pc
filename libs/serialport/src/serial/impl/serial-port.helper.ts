import { Logger } from '@nestjs/common';
import { EMPTY, exhaustMap, Observable, Subject, throwError, timer } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { SerialPort, SerialPortOpenOptions } from 'serialport';

import { ParserConfig, SerialOptions, SerialPortState } from '../serial-adapter.interface';

/**
 * @internal
 */
export function retryStrategy(
  connection$: Observable<SerialPortState>,
  path: string,
  retryDelay: number,
  maxAttempts: number,
  logger: Logger,
): Observable<SerialPortState> {
  return connection$.pipe(
    retry({
      delay: (error, retryCount) => {
        if (retryCount > maxAttempts) {
          return throwError(() => new Error(`Max reconnect attempts (${maxAttempts}) exceeded for ${path}`));
        }
        logger.log(`Reconnecting ${path} in ${retryDelay}ms (attempt ${retryCount}/${maxAttempts})`);
        return timer(retryDelay);
      },
    }),
  );
}

/**
 * @internal
 */
export function exponentialStrategy(
  connection$: Observable<SerialPortState>,
  path: string,
  retryDelay: number,
  maxAttempts: number,
  logger: Logger,
): Observable<SerialPortState> {
  return connection$.pipe(
    retry({
      delay: (error, retryCount) => {
        if (retryCount > maxAttempts) {
          return throwError(() => new Error(`Max reconnect attempts (${maxAttempts}) exceeded for ${path}`));
        }
        const delay = Math.min(retryDelay * Math.pow(2, retryCount - 1), 60000);
        logger.log(`Reconnecting ${path} in ${delay}ms (attempt ${retryCount}/${maxAttempts})`);
        return timer(delay);
      },
    }),
  );
}

/**
 * @internal
 */
export function intervalStrategy(
  connection$: Observable<SerialPortState>,
  path: string,
  retryDelay: number,
  maxAttempts: number,
  logger: Logger,
): Observable<SerialPortState> {
  return timer(0, retryDelay).pipe(
    exhaustMap((i) =>
      connection$.pipe(
        catchError((err) => {
          // To allow retries, we re-throw the error, but the outer timer will continue.
          // If the intent was to ignore the error and just wait for the next interval, EMPTY is correct.
          // For retry behavior, re-throwing is more appropriate.
          logger.warn(`Connection attempt ${i + 1} for ${path} failed. Retrying in ${retryDelay}ms...`);
          return EMPTY; // Return EMPTY to ignore the error and allow the outer timer to continue for the next interval
        }),
      ),
    ),
  );
}

export class SerialPortHandler {
  public readonly port: SerialPort;
  public readonly parser: any;
  public readonly rawData$: Subject<Buffer>;
  public readonly error$: Subject<Error>;

  constructor(
    path: string,
    options: SerialOptions,
    private readonly _logger: Logger,
    private readonly _createParser: (port: SerialPort, config: ParserConfig) => any,
  ) {
    const portOptions: SerialPortOpenOptions<any> = {
      path,
      baudRate: options.baudRate,
      dataBits: options.dataBits ?? 8,
      stopBits: options.stopBits ?? 1,
      parity: options.parity ?? 'none',
      autoOpen: false,
    };

    this.port = new SerialPort(portOptions);
    this.parser = this._createParser(this.port, options.parser || { type: 'raw' });
    this.rawData$ = new Subject<Buffer>();
    this.error$ = new Subject<Error>();

    this._setupListeners(options);
  }

  private _setupListeners(options: SerialOptions): void {
    this.port.on('open', () => {
      this._logger.log(`Port ${this.port.path} opened successfully`);
    });

    this.port.on('error', (err: Error) => {
      this._logger.error(`Port ${this.port.path} error:`, err);
      this.error$.next(err);
    });

    this.port.on('close', () => {
      this._logger.warn(`Port ${this.port.path} closed`);
    });

    this.parser.on('data', (data: Buffer) => {
      if (options.validateData && !options.validateData(data)) {
        this.error$.next(new Error('Invalid data format'));
        return;
      }
      if (options.headerByte !== undefined && data.length > 0 && data[0] !== options.headerByte) {
        this.error$.next(new Error('Invalid header byte'));
        return;
      }
      this.rawData$.next(data);
    });
  }

  public async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.port.isOpen) {
        this.port.close((err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public destroy(): void {
    this.port.removeAllListeners();
    if (this.parser !== this.port) {
      this.parser.removeAllListeners();
    }
    this.rawData$.complete();
    this.error$.complete();
  }
}
