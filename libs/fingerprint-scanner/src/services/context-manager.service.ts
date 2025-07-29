import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';

import { FINGERPRINT_CMD, FINGERPRINT_RESPONSE_ID } from '../enums/fingerprint.enum';
import { FINGERPRINT_SCAN_CONFIG } from '../fingerprint-scan.constants';
import { IFingerprintScanConfig } from '../interfaces/config.interface';
import { ICommandContext, ContextConfig, IContextualResponse, HookScope } from '../interfaces/context.interface';
import { FingerprintResponse } from '../interfaces/response.interface';

@Injectable()
export class ContextManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(ContextManagerService.name);

  private _contexts = new Map<string, ContextConfig>();
  private _activeCommands = new Map<string, ICommandContext>();
  private _commandQueue: ICommandContext[] = [];

  private _cleanupInterval: NodeJS.Timeout;

  constructor(@Inject(FINGERPRINT_SCAN_CONFIG) private readonly _config: IFingerprintScanConfig) {}

  public onModuleInit(): void {
    this._startPeriodicCleanup();
  }

  public onModuleDestroy(): void {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
  }

  public createContext(config: ContextConfig): string {
    this._contexts.set(config.name, config);
    this._logger.debug(`Created context: ${config.name}`);
    return config.name;
  }

  public destroyContext(contextName: string): void {
    const config = this._contexts.get(contextName);
    if (config?.autoCleanup) {
      // Cleanup will be handled by hook registry
    }

    this._contexts.delete(contextName);
    this._logger.debug(`Destroyed context: ${contextName}`);
  }

  public trackCommand(command: FINGERPRINT_CMD, contextName?: string, metadata?: any): string {
    const correlationId = this._generateCorrelationId();

    const commandContext: ICommandContext = {
      id: correlationId,
      command,
      timestamp: new Date(),
      module: contextName,
      metadata,
    };

    this._activeCommands.set(correlationId, commandContext);
    this._commandQueue.push(commandContext);

    if (this._commandQueue.length > 50) {
      const oldContext = this._commandQueue.shift();
      if (oldContext) {
        this._activeCommands.delete(oldContext.id);
      }
    }

    this._logger.debug(`Tracking command: ${command}, correlation: ${correlationId}, context: ${contextName}`);
    return correlationId;
  }

  public correlateResponse(response: FingerprintResponse): IContextualResponse {
    const matchingContext = this._findMatchingCommand(response);

    if (matchingContext) {
      this._activeCommands.delete(matchingContext.id);

      return {
        ...response,
        context: matchingContext,
        correlationId: matchingContext.id,
      };
    }

    return {
      ...response,
      correlationId: 'unknown',
    };
  }

  public shouldExecuteHook(response: IContextualResponse, hookScope?: HookScope, hookContextName?: string): boolean {
    if (!hookScope && !hookContextName) {
      return true;
    }

    if (hookContextName && response.context?.module) {
      const hookContext = this._contexts.get(hookContextName);

      if (hookContext?.isolated && hookContextName !== response.context.module) {
        return false;
      }
    }

    if (hookScope) {
      if (hookScope.context && hookScope.context !== response.context?.module) {
        return false;
      }

      if (hookScope.commands && response.context) {
        if (!hookScope.commands.includes(response.context.command)) {
          return false;
        }
      }

      if (hookScope.correlationId && hookScope.correlationId !== response.correlationId) {
        return false;
      }
    }

    return true;
  }

  public getActiveCommand(correlationId: string): ICommandContext | undefined {
    return this._activeCommands.get(correlationId);
  }

  public triggerCleanup(): number {
    return this._clearExpiredCommands(this._config.maxCommandAge);
  }

  public getContextInfo(): any {
    return {
      contexts: Array.from(this._contexts.entries()).map(([name, config]) => ({
        // @ts-ignore
        name,
        ...config,
      })),
      activeCommands: this._activeCommands.size,
      commandQueue: this._commandQueue.length,
    };
  }

  private _clearExpiredCommands(maxAge: number = 60000): number {
    const cutoffTime = Date.now() - maxAge;
    let removedCount = 0;

    for (const [correlationId, context] of this._activeCommands.entries()) {
      if (context.timestamp.getTime() < cutoffTime) {
        this._activeCommands.delete(correlationId);
        removedCount++;
      }
    }

    this._commandQueue = this._commandQueue.filter((ctx) => ctx.timestamp.getTime() >= cutoffTime);

    if (removedCount > 0) {
      this._logger.debug(`Cleared ${removedCount} expired commands`);
    }

    return removedCount;
  }

  private _startPeriodicCleanup(): void {
    const cleanupInterval = this._config.cleanupInterval || 5 * 60 * 1000;
    const maxAge = this._config.maxCommandAge || 60 * 1000;

    this._cleanupInterval = setInterval(() => {
      const removedCount = this._clearExpiredCommands(maxAge);
      if (removedCount > 0) {
        this._logger.log(`Periodic cleanup removed ${removedCount} expired commands`);
      }
    }, cleanupInterval);

    this._logger.log(`Started periodic cleanup with interval: ${cleanupInterval}ms, maxAge: ${maxAge}ms`);
  }

  private _findMatchingCommand(response: FingerprintResponse): ICommandContext | null {
    for (let i = this._commandQueue.length - 1; i >= 0; i--) {
      const context = this._commandQueue[i];

      if (this._couldCommandProduceResponse(context.command, response)) {
        this._commandQueue.splice(i, 1);
        return context;
      }
    }

    return null;
  }

  private _couldCommandProduceResponse(command: FINGERPRINT_CMD, response: FingerprintResponse): boolean {
    switch (command) {
      case FINGERPRINT_CMD.REGISTER:
        return (
          response.id === FINGERPRINT_RESPONSE_ID.SUCCESS_REGISTER ||
          response.id === FINGERPRINT_RESPONSE_ID.ERROR_REGISTER ||
          response.id === FINGERPRINT_RESPONSE_ID.ERROR_CONNECT
        );
      default:
        this._logger.warn(`Unknown command type: ${command}`);
        return false;
    }
  }

  private _generateCorrelationId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
