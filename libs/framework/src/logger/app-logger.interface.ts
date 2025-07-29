/** biome-ignore-all lint/suspicious/noExplicitAny: false */

import { LoggerService } from '@nestjs/common';

export type LoggerLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface IAppLogger extends LoggerService {
  child(bindings: Record<string, any>): IAppLogger;

  setContext(context: string): void;

  flush(): void;

  getLevel(): string;

  setLevel(level: string): void;
  isLevelEnabled(level: LoggerLevel): boolean;

  getInstance(): any;
}
