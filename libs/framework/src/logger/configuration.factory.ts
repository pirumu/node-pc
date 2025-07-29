/** biome-ignore-all lint/suspicious/noExplicitAny: true */
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';

import { TRACING_ID, VERSION_KEY } from '../constants';

import { AppLoggerModuleOptions } from './app-logger.module.interface';
import { LogFormat, SerializedRequest, SerializedResponse } from './app-logger.types';

export class ConfigurationFactory {
  private _sensitiveFields = ['password', 'token', 'secret'];

  constructor(
    private readonly _cls: ClsService,
    private readonly _options: AppLoggerModuleOptions,
  ) {}
  createLoggerConfiguration() {
    return {
      level: this._getLogLevel(),
      transport: this._getTransport(),
      autoLogging: true,
      serializers: this._createSerializers(),
      timestamp: this._createTimestampFunction(),
      errorKey: 'error',
      formatters: this._createFormatters(),
    };
  }
  createHttpLoggerConfiguration() {
    return {
      forRoutes: ['*'],
      exclude: this._getExcludedRoutes(),
      pinoHttp: {
        level: this._getLogLevel(),
        transport: this._getTransport(),
        autoLogging: true,
        serializers: this._createSerializers(),
        timestamp: this._createTimestampFunction(),
        errorKey: 'error',
        formatters: this._createFormatters(),
      },
    };
  }

  private _getLogLevel(): string {
    return this._options.logLevel || 'info';
  }

  private _getTransport() {
    return this._options.env !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
            levelFirst: true,
          },
        }
      : undefined;
  }
  private _getExcludedRoutes(): string[] {
    return this._options.excludedRoutes || [];
  }

  private _createSerializers() {
    return {
      req: this._createRequestSerializer(),
      res: this._createResponseSerializer(),
      time: this._createTimeSerializer(),
    };
  }

  private _createRequestSerializer() {
    return (req: Request): SerializedRequest => {
      const tracingId = this._extractTracingId(req);
      const version = this._extractVersion(req);

      const sr = {
        method: req.method,
        url: this._sanitizeUrl(req.url),
        query: this._sanitizeQuery(req.query),
        params: req.params,
      };

      return this._options.logLevel === 'debug'
        ? {
            ...sr,
            body: this._sanitizeBody(req.body),
            headers: {
              [TRACING_ID]: tracingId,
              [VERSION_KEY]: version,
            },
          }
        : { ...sr };
    };
  }

  private _createResponseSerializer() {
    return (res: Response): SerializedResponse => ({
      statusCode: res.statusCode,
    });
  }

  private _createTimeSerializer() {
    return (time: number) => ({
      timestamp: new Date(time).toISOString(),
    });
  }

  private _createTimestampFunction() {
    return () => `,"timestamp":"${new Date().toISOString()}"`;
  }

  private _createFormatters() {
    return {
      level: (label: string) => ({ level: label }),
      bindings: () => ({}), // Remove default bindings
      log: this._createLogFormatter(),
    };
  }

  private _createLogFormatter() {
    return (object: any): LogFormat => {
      const { req: _req, context, responseTime, error, err, ...loggedObject } = object;
      const loggedError = error ?? err;
      const requestId = this._cls?.getId();

      const logFormat: LogFormat = {
        context,
        error: loggedError,
        tracing_id: requestId,
        response_time: responseTime ? `+${responseTime}ms` : undefined,
        ...loggedObject,
      };

      const message = this._extractMessage(loggedObject, loggedError);
      if (message) {
        logFormat.msg = message;
      }

      return this._cleanupLogFormat(logFormat);
    };
  }

  // Helper methods
  private _extractTracingId(req: Request): string | undefined {
    return (req.headers[TRACING_ID] as string) || this._cls?.getId();
  }

  private _extractVersion(req: Request): string | undefined {
    return req.headers[VERSION_KEY] as string;
  }

  private _sanitizeUrl(url: string): string {
    // Remove sensitive query parameters
    let sanitizedUrl = url;

    this._sensitiveFields.forEach((param) => {
      const regex = new RegExp(`[?&]${param}=[^&]*`, 'gi');
      sanitizedUrl = sanitizedUrl.replace(regex, `${param}=***`);
    });

    return sanitizedUrl;
  }

  private _sanitizeQuery(query: any): any {
    if (!query || typeof query !== 'object') {
      return query;
    }

    const sanitized = { ...query };
    this._sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    });

    return sanitized;
  }

  private _sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }
    const sanitized = { ...body };
    this._sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    });

    return sanitized;
  }

  private _extractMessage(loggedObject: any, loggedError: any): string | undefined {
    return loggedObject.msg || loggedError?.message;
  }

  private _cleanupLogFormat(logFormat: LogFormat): LogFormat {
    // Remove undefined values
    return Object.entries(logFormat).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as LogFormat);
  }
}
