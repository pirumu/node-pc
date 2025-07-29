import { LoggerService } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import pino, { Level, Logger as PinoLogger } from 'pino';

import { PinoLoggerOptions } from './app-logger.module.interface';

export class AppLoggerService implements LoggerService {
  private readonly _logger: PinoLogger;
  private readonly _contextName: string;

  constructor(
    options: PinoLoggerOptions = {},
    private readonly _cls?: ClsService,
  ) {
    this._contextName = options.contextName || 'context';
    this._logger = this._createLogger(options);
  }

  private _createLogger(options: PinoLoggerOptions): PinoLogger {
    const config: pino.LoggerOptions = {
      level: options.logLevel || 'info',
      timestamp: options.enableTimestamp !== false ? () => `,"timestamp":"${new Date().toISOString()}"` : false,

      base: {
        ...options.base,
      },

      formatters: {
        level: options.formatters?.level || ((label: string) => ({ level: label })),
        bindings: options.formatters?.bindings || (() => ({})),
        log: options.formatters?.log || this._createLogFormatter(options),
      },

      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
        ...options.serializers,
      },

      redact: options.redact || [],

      mixin:
        options.mixins ||
        (() => {
          const mixinData: Record<string, any> = {};

          if (options.enableTracing !== false && this._cls) {
            const tracingId = this._cls.getId();
            if (tracingId) {
              mixinData.tracing_id = tracingId;
            }
          }

          return mixinData;
        }),

      transport: options.transport || this._getDefaultTransport(options),
    };

    return pino(config);
  }

  private _createLogFormatter(options: PinoLoggerOptions) {
    const keys = new Set(['req', 'res', 'responseTime', 'pid', 'hostname']);
    return (object: Record<string, unknown>) => {
      // Clean any unwanted fields
      const cleanObject: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(object)) {
        if (!keys.has(key)) {
          cleanObject[key] = value;
        }
      }

      // Add tracing context if available and enabled
      if (options.enableTracing !== false && this._cls) {
        const tracingId = this._cls.getId();
        if (tracingId) {
          cleanObject.tracing_id = tracingId;
        }
      }

      return cleanObject;
    };
  }

  private _getDefaultTransport(options: PinoLoggerOptions) {
    if (options.prettyPrint || process.env.NODE_ENV === 'development') {
      return {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
          levelFirst: true,
        },
      };
    }
    return undefined;
  }

  public verbose(message: any, ...optionalParams: any[]): void {
    this._call('trace', message, ...optionalParams);
  }

  public debug(message: any, ...optionalParams: any[]): void {
    this._call('debug', message, optionalParams);
  }

  public log(message: any, ...optionalParams: any[]): void {
    this._call('info', message, ...optionalParams);
  }

  public warn(message: any, ...optionalParams: any[]): void {
    this._call('warn', message, ...optionalParams);
  }

  public error(message: any, ...optionalParams: any[]): void {
    this._call('error', message, ...optionalParams);
  }

  public fatal(message: any, ...optionalParams: any[]): void {
    this._call('fatal', message, ...optionalParams);
  }

  public info(message: any, ...optionalParams: any[]): void {
    this._call('info', message, ...optionalParams);
  }

  public child(bindings: Record<string, any>): AppLoggerService {
    const childLogger = new AppLoggerService(
      {
        contextName: this._contextName,
        enableTracing: false,
      },
      this._cls,
    );

    (childLogger as any).logger = this._logger.child(bindings);

    return childLogger;
  }

  public setContext(context: string): void {
    const contextLogger = this.child({ [this._contextName]: context });
    Object.setPrototypeOf(this, contextLogger);
  }

  private _call(level: Level, message: any, ...optionalParams: any[]): void {
    const objArg: Record<string, any> = {};
    let params: any[] = [];
    if (optionalParams.length !== 0) {
      const lastParam = optionalParams[optionalParams.length - 1];
      if (typeof lastParam === 'string') {
        objArg[this._contextName] = lastParam;
        params = optionalParams.slice(0, -1);
      } else {
        params = optionalParams;
      }
    }
    for (const param of params) {
      if (typeof param === 'object' && param !== null && !(param instanceof Error)) {
        Object.assign(objArg, param);
      }
    }
    const messageParams = params.filter((param) => typeof param !== 'object' || param === null || param instanceof Error);
    if (typeof message === 'object') {
      if (message instanceof Error) {
        objArg.err = message;
        objArg.message = message.message;
      } else {
        Object.assign(objArg, message);
      }
      this._logger[level](objArg, ...messageParams);
    } else if (this._isWrongExceptionsHandlerContract(level, message, messageParams)) {
      // Handle NestJS exception handler contract
      objArg.err = new Error(message);
      objArg.err.stack = messageParams[0];
      objArg.message = message;
      this._logger[level](objArg);
    } else {
      // Standard logging
      if (messageParams.length > 0) {
        this._logger[level](objArg, message, ...messageParams);
      } else {
        if (Object.keys(objArg).length > 0) {
          this._logger[level](objArg, message);
        } else {
          this._logger[level](message);
        }
      }
    }
  }

  private _isWrongExceptionsHandlerContract(level: Level, message: any, params: any[]): params is [string] {
    return (
      level === 'error' && typeof message === 'string' && params.length === 1 && typeof params[0] === 'string' && /\n\s*at /.test(params[0])
    );
  }

  public flush(): void {
    // Pino doesn't have flush method by default, but we can add it
    if (typeof (this._logger as any).flush === 'function') {
      (this._logger as any).flush();
    }
  }

  public getLevel(): string {
    return this._logger.level;
  }

  public setLevel(level: string): void {
    this._logger.level = level;
  }

  public isLevelEnabled(level: Level): boolean {
    return this._logger.isLevelEnabled(level);
  }

  public getInstance(): PinoLogger {
    return this._logger;
  }
}
