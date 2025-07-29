import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

import { FINGERPRINT_CMD, FINGERPRINT_RESPONSE_ID } from '../enums/fingerprint.enum';
import { ContextConfig, IContextualResponse, HookScope } from '../interfaces/context.interface';
import { IContextualResponseHook } from '../interfaces/hook.interface';
import { CommandResult } from '../interfaces/response.interface';

import { ContextManagerService } from './context-manager.service';
import { FingerprintCommandService } from './fingerprint-command.service';
import { FingerprintResponseService } from './fingerprint-response.service';
import { HookRegistryService } from './hook-registry.service';

@Injectable()
export class FingerprintContextService {
  constructor(
    private readonly _contextManager: ContextManagerService,
    private readonly _hookRegistry: HookRegistryService,
    private readonly _commandService: FingerprintCommandService,
    private readonly _responseService: FingerprintResponseService,
  ) {}

  public createContext(config: ContextConfig): FingerprintContextInstance {
    const contextName = this._contextManager.createContext(config);
    return new FingerprintContextInstance(
      contextName,
      this._contextManager,
      this._hookRegistry,
      this._commandService,
      this._responseService,
    );
  }
}

export class FingerprintContextInstance {
  constructor(
    private readonly _contextName: string,
    private readonly _contextManager: ContextManagerService,
    private readonly _hookRegistry: HookRegistryService,
    public readonly commandService: FingerprintCommandService,
    private readonly _responseService: FingerprintResponseService,
  ) {}

  public async sendRegisterCommand(metadata?: any): Promise<CommandResult> {
    if (!this.commandService.canSendCommands()) {
      throw new Error('Process not available for send command');
    }
    const correlationId = this._contextManager.trackCommand(FINGERPRINT_CMD.REGISTER, this._contextName, metadata);

    const result = await this.commandService.sendCommand(FINGERPRINT_CMD.REGISTER, this._contextName);

    return {
      ...result,
      correlationId,
    };
  }

  public async sendCommand(command: FINGERPRINT_CMD, metadata?: any): Promise<CommandResult> {
    if (!this.commandService.canSendCommands()) {
      throw new Error('Process not available for send command');
    }
    const correlationId = this._contextManager.trackCommand(command, this._contextName, metadata);

    const result = await this.commandService.sendCommand(command, this._contextName);

    return {
      ...result,
      correlationId,
    };
  }

  public async sendCommandWithRetry(command: FINGERPRINT_CMD, metadata?: any): Promise<CommandResult> {
    if (!this.commandService.canSendCommands()) {
      throw new Error('Process not available for send command');
    }
    const correlationId = this._contextManager.trackCommand(command, this._contextName, metadata);

    const result = await this.commandService.sendCommandWithRetry(command);

    return {
      ...result,
      correlationId,
    };
  }

  public registerSuccessHook(handler: IContextualResponseHook, scope?: Omit<HookScope, 'context'>): string {
    return this._hookRegistry.registerSuccessHook(handler, { ...scope, context: this._contextName }, this._contextName);
  }

  public registerErrorHook(handler: IContextualResponseHook, scope?: Omit<HookScope, 'context'>): string {
    return this._hookRegistry.registerErrorHook(handler, { ...scope, context: this._contextName }, this._contextName);
  }

  public registerCommandSpecificHook(
    command: FINGERPRINT_CMD,
    responseId: FINGERPRINT_RESPONSE_ID,
    handler: IContextualResponseHook,
  ): string {
    return this._hookRegistry.registerCommandSpecificHook(command, responseId, handler, this._contextName);
  }

  public getResponses$(): Observable<IContextualResponse> {
    return this._responseService
      .getResponses$()
      .pipe(
        filter((response: any) => !response.context?.module || response.context.module === this._contextName),
      ) as Observable<IContextualResponse>;
  }

  public getSuccessResponses$(): Observable<IContextualResponse> {
    return this.getResponses$().pipe(filter((response) => response.id === FINGERPRINT_RESPONSE_ID.SUCCESS_REGISTER));
  }

  public getErrorResponses$(): Observable<IContextualResponse> {
    return this.getResponses$().pipe(
      filter((response) => [FINGERPRINT_RESPONSE_ID.ERROR_CONNECT, FINGERPRINT_RESPONSE_ID.ERROR_REGISTER].includes(response.id)),
    );
  }

  public unregisterHook(hookId: string): boolean {
    return this._hookRegistry.unregisterHook(hookId);
  }

  public clearAllHooks(): void {
    this._hookRegistry.clearContextHooks(this._contextName);
  }

  public destroy(): void {
    this.clearAllHooks();
    this._contextManager.destroyContext(this._contextName);
  }

  public getContextInfo(): { name: string; hooks: any } {
    return {
      name: this._contextName,
      hooks: this._hookRegistry.getHooksInfo(),
    };
  }
}
