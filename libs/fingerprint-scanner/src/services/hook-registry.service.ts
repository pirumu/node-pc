import { Injectable, Logger } from '@nestjs/common';

import { FINGERPRINT_RESPONSE_ID, FINGERPRINT_CMD } from '../enums/fingerprint.enum';
import { IContextualResponse, HookScope } from '../interfaces/context.interface';
import {
  EnhancedResponseHookConfig,
  EnhancedCommandHookConfig,
  IContextualResponseHook,
  ContextualCommandHook,
  ProcessHookConfig,
  ErrorHookConfig,
  ProcessHook,
  ErrorHook,
} from '../interfaces/hook.interface';
import { FingerprintResponse, CommandResult, ProcessEvent } from '../interfaces/response.interface';

import { ContextManagerService } from './context-manager.service';

type RegisteredEnhancedHook = {
  id: string;
  contextName?: string;
  scope?: HookScope;
  priority: number;
  once: boolean;
  persistent: boolean;
  registeredAt: Date;
  executionCount: number;
  lastExecuted?: Date;
};

type RegisteredResponseHook = RegisteredEnhancedHook & {
  handler: IContextualResponseHook;
};

type RegisteredCommandHook = RegisteredEnhancedHook & {
  handler: ContextualCommandHook;
};

type RegisteredProcessHook = RegisteredEnhancedHook & {
  handler: ProcessHook;
  eventTypes?: ProcessEvent['type'][];
};

type RegisteredErrorHook = RegisteredEnhancedHook & {
  handler: ErrorHook;
  contexts?: string[];
};

@Injectable()
export class HookRegistryService {
  private readonly _logger = new Logger(HookRegistryService.name);

  private _responseHooks = new Map<string, RegisteredResponseHook>();
  private _commandHooks = new Map<string, RegisteredCommandHook>();
  private _processHooks = new Map<string, RegisteredProcessHook>();
  private _errorHooks = new Map<string, RegisteredErrorHook>();

  constructor(private _contextManager: ContextManagerService) {}

  public registerResponseHook(config: EnhancedResponseHookConfig, contextName?: string): string {
    const hookId = config.id || this._generateHookId('response');
    const hook: RegisteredResponseHook = {
      id: hookId,
      contextName,
      handler: config.handler,
      scope: config.scope,
      priority: config.priority || 0,
      once: config.once || false,
      persistent: config.persistent || false,
      registeredAt: new Date(),
      executionCount: 0,
    };

    this._responseHooks.set(hookId, hook);
    this._logger.debug(`Registered response hook: ${hookId} (context: ${contextName})`);
    return hookId;
  }

  public registerSuccessHook(handler: IContextualResponseHook, scope?: HookScope, contextName?: string): string {
    return this.registerResponseHook({ handler, scope }, contextName);
  }

  public registerErrorHook(handler: IContextualResponseHook, scope?: HookScope, contextName?: string): string {
    return this.registerResponseHook({ handler, scope }, contextName);
  }

  public registerCommandSpecificHook(
    command: FINGERPRINT_CMD,
    responseId: FINGERPRINT_RESPONSE_ID,
    handler: IContextualResponseHook,
    contextName?: string,
  ): string {
    return this.registerResponseHook({ handler, scope: { commands: [command], context: contextName } }, contextName);
  }

  public async processResponse(response: FingerprintResponse): Promise<void> {
    const contextualResponse = this._contextManager.correlateResponse(response);
    const hooks = this._getMatchingResponseHooks(contextualResponse);

    if (hooks.length === 0) {
      this._logger.debug(`No hooks for response ID ${response.id} in context ${contextualResponse.context?.module}`);
      return;
    }

    this._logger.debug(`Processing response through ${hooks.length} hooks (context: ${contextualResponse.context?.module})`);
    await this._executeResponseHooks(hooks, contextualResponse);
    this._removeOnceHooks(this._responseHooks, hooks);
  }

  public registerCommandHook(config: EnhancedCommandHookConfig, contextName?: string): string {
    const hookId = config.id || this._generateHookId('command');
    const hook: RegisteredCommandHook = {
      id: hookId,
      contextName,
      handler: config.handler,
      scope: config.scope,
      priority: config.priority || 0,
      once: config.once || false,
      persistent: config.persistent || false,
      registeredAt: new Date(),
      executionCount: 0,
    };

    this._commandHooks.set(hookId, hook);
    this._logger.debug(`Registered command hook: ${hookId} (context: ${contextName})`);
    return hookId;
  }

  public async processCommandResult(result: CommandResult, correlationId?: string): Promise<void> {
    const hooks = Array.from(this._commandHooks.values()).sort((a, b) => b.priority - a.priority);
    const context = correlationId ? this._contextManager.getActiveCommand(correlationId) : undefined;

    await this._executeCommandHooks(hooks, result, context);
    this._removeOnceHooks(this._commandHooks, hooks);
  }

  public registerProcessHook(config: ProcessHookConfig): string {
    const hookId = config.id || this._generateHookId('process');
    const hook: RegisteredProcessHook = {
      id: hookId,
      handler: config.handler,
      eventTypes: config.eventTypes,
      priority: config.priority || 0,
      once: config.once || false,
      persistent: config.persistent || false,
      registeredAt: new Date(),
      executionCount: 0,
    };

    this._processHooks.set(hookId, hook);
    this._logger.debug(`Registered process hook: ${hookId}`);
    return hookId;
  }

  public async processProcessEvent(event: ProcessEvent): Promise<void> {
    const hooks = this._getMatchingProcessHooks(event);
    await this._executeProcessHooks(hooks, event);
    this._removeOnceHooks(this._processHooks, hooks);
  }

  public registerGlobalErrorHook(config: ErrorHookConfig): string {
    const hookId = config.id || this._generateHookId('error');
    const hook: RegisteredErrorHook = {
      id: hookId,
      handler: config.handler,
      contexts: config.contexts,
      priority: config.priority || 0,
      once: config.once || false,
      persistent: config.persistent || false,
      registeredAt: new Date(),
      executionCount: 0,
    };

    this._errorHooks.set(hookId, hook);
    this._logger.debug(`Registered error hook: ${hookId}`);
    return hookId;
  }

  public async processError(error: Error, context: string): Promise<void> {
    const hooks = this._getMatchingErrorHooks(context);
    await this._executeErrorHooks(hooks, error, context);
    this._removeOnceHooks(this._errorHooks, hooks);
  }

  public clearResponseHooks(): void {
    this._responseHooks.clear();
    this._logger.debug('Cleared all response hooks');
  }

  public clearCommandHooks(): void {
    this._commandHooks.clear();
    this._logger.debug('Cleared all command hooks');
  }

  public clearProcessHooks(): void {
    this._processHooks.clear();
    this._logger.debug('Cleared all process hooks');
  }

  public clearErrorHooks(): void {
    this._errorHooks.clear();
    this._logger.debug('Cleared all error hooks');
  }

  public clearContextHooks(contextName: string): number {
    let count = 0;

    for (const [id, hook] of this._responseHooks.entries()) {
      if (hook.contextName === contextName) {
        this._responseHooks.delete(id);
        count++;
      }
    }

    for (const [id, hook] of this._commandHooks.entries()) {
      if (hook.contextName === contextName) {
        this._commandHooks.delete(id);
        count++;
      }
    }

    this._logger.debug(`Cleared ${count} hooks for context: ${contextName}`);
    return count;
  }

  public unregisterHook(hookId: string): boolean {
    const isRemoved =
      this._responseHooks.delete(hookId) ||
      this._commandHooks.delete(hookId) ||
      this._processHooks.delete(hookId) ||
      this._errorHooks.delete(hookId);

    if (isRemoved) {
      this._logger.debug(`Unregistered hook: ${hookId}`);
    }

    return isRemoved;
  }

  public getHooksInfo(): any {
    return {
      response: Array.from(this._responseHooks.values()).map(this._hookToInfo),
      command: Array.from(this._commandHooks.values()).map(this._hookToInfo),
      process: Array.from(this._processHooks.values()).map(this._hookToInfo),
      error: Array.from(this._errorHooks.values()).map(this._hookToInfo),
      contexts: this._contextManager.getContextInfo(),
    };
  }

  private _getMatchingResponseHooks(response: IContextualResponse): RegisteredResponseHook[] {
    return Array.from(this._responseHooks.values())
      .filter(
        (hook) =>
          this._contextManager.shouldExecuteHook(response, hook.scope, hook.contextName) &&
          this._shouldHookExecuteForResponse(hook, response),
      )
      .sort((a, b) => b.priority - a.priority);
  }

  private _getMatchingProcessHooks(event: ProcessEvent): RegisteredProcessHook[] {
    return Array.from(this._processHooks.values())
      .filter((hook) => !hook.eventTypes || hook.eventTypes.includes(event.type))
      .sort((a, b) => b.priority - a.priority);
  }

  private _getMatchingErrorHooks(context: string): RegisteredErrorHook[] {
    return Array.from(this._errorHooks.values())
      .filter((hook) => !hook.contexts || hook.contexts.includes(context))
      .sort((a, b) => b.priority - a.priority);
  }

  private _shouldHookExecuteForResponse(hook: RegisteredResponseHook, response: IContextualResponse): boolean {
    if (hook.scope?.commands && response.context) {
      return hook.scope.commands.includes(response.context.command);
    }
    return true;
  }

  private async _executeResponseHooks(hooks: RegisteredResponseHook[], response: IContextualResponse): Promise<void> {
    for (const hook of hooks) {
      try {
        await hook.handler(response);
        hook.executionCount++;
        hook.lastExecuted = new Date();
      } catch (err) {
        this._logger.error(`Response hook ${hook.id} execution failed:`, err);
      }
    }
  }

  private async _executeCommandHooks(hooks: RegisteredCommandHook[], result: CommandResult, context?: any): Promise<void> {
    for (const hook of hooks) {
      try {
        await hook.handler(result, context);
        hook.executionCount++;
        hook.lastExecuted = new Date();
      } catch (err) {
        this._logger.error(`Command hook ${hook.id} execution failed:`, err);
      }
    }
  }

  private async _executeProcessHooks(hooks: RegisteredProcessHook[], event: ProcessEvent): Promise<void> {
    for (const hook of hooks) {
      try {
        await hook.handler(event);
        hook.executionCount++;
        hook.lastExecuted = new Date();
      } catch (err) {
        this._logger.error(`Process hook ${hook.id} execution failed:`, err);
      }
    }
  }

  private async _executeErrorHooks(hooks: RegisteredErrorHook[], error: Error, context: string): Promise<void> {
    for (const hook of hooks) {
      try {
        await hook.handler(error, context);
        hook.executionCount++;
        hook.lastExecuted = new Date();
      } catch (err) {
        this._logger.error(`Error hook ${hook.id} execution failed:`, err);
      }
    }
  }

  private _removeOnceHooks<T extends RegisteredEnhancedHook>(map: Map<string, T>, hooks: T[]): void {
    for (const hook of hooks) {
      if (hook.once) {
        map.delete(hook.id);
      }
    }
  }

  private _hookToInfo(hook: RegisteredEnhancedHook): any {
    return {
      id: hook.id,
      contextName: hook.contextName,
      scope: hook.scope,
      priority: hook.priority,
      once: hook.once,
      persistent: hook.persistent,
      registeredAt: hook.registeredAt,
      executionCount: hook.executionCount,
      lastExecuted: hook.lastExecuted,
    };
  }

  private _generateHookId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
