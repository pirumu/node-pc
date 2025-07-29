export type AppLoggerModuleOptions = {
  env?: string;
  /**
   * Log level (default: 'info')
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Routes to exclude from logging
   */
  excludedRoutes?: string[];

  /**
   * Sensitive fields to sanitize in logs
   */
  sensitiveFields?: string[];

  /**
   * Whether to log request body (default: true)
   */
  logRequestBody?: boolean;

  /**
   * Whether to log response body (default: false)
   */
  logResponseBody?: boolean;

  /**
   * Maximum log size in characters (default: 10000)
   */
  maxLogSize?: number;

  /**
   * Whether to enable auto logging for HTTP requests (default: false)
   */
  autoLogging?: boolean;

  /**
   * Custom timestamp format function
   */
  timestampFormat?: () => string;

  /**
   * Pretty print logs in development (default: auto-detect)
   */
  prettyPrint?: boolean;

  /**
   * Additional pino options
   */
  pinoOptions?: Record<string, any>;

  /**
   * Custom serializers
   */
  customSerializers?: Record<string, (obj: any) => any>;

  /**
   * Custom formatters
   */
  customFormatters?: {
    level?: (label: string) => any;
    bindings?: (bindings: any) => any;
    log?: (object: any) => any;
  };

  /**
   * Enable request correlation tracking (default: true)
   */
  enableCorrelation?: boolean;

  /**
   * Custom correlation ID generator
   */
  correlationIdGenerator?: () => string;
};

// 2. Async Options Interface
export type AppLoggerModuleAsyncOptions = {
  imports?: any[];
  inject?: any[];
  useFactory?: (...args: any[]) => Promise<AppLoggerModuleOptions> | AppLoggerModuleOptions;
  useClass?: any;
  useExisting?: any;
  global?: boolean;
};

export type PinoLoggerOptions = {
  logLevel?: string;
  prettyPrint?: boolean;
  contextName?: string;
  enableTracing?: boolean;
  enableTimestamp?: boolean;
  redact?: string[];
  transport?: any;
  formatters?: {
    level?: (label: string) => any;
    bindings?: (bindings: any) => any;
    log?: (object: any) => any;
  };
  serializers?: Record<string, (obj: any) => any>;
  base?: Record<string, any>;
  mixins?: () => Record<string, any>;
};
