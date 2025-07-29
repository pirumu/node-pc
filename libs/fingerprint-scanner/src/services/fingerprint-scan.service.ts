import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';

import { FINGERPRINT_SCAN_CONFIG } from '../fingerprint-scan.constants';
import { IFingerprintScanConfig } from '../interfaces/config.interface';
import { ContextConfig } from '../interfaces/context.interface';
import { FingerprintResponse } from '../interfaces/response.interface';

import { ContextManagerService } from './context-manager.service';
import { FingerprintContextService, FingerprintContextInstance } from './fingerprint-context.service';
import { FingerprintProcessService, ProcessStatus } from './fingerprint-process.service';
import { FingerprintResponseService } from './fingerprint-response.service';
import { HookRegistryService } from './hook-registry.service';

@Injectable()
export class FingerprintScanService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(FingerprintScanService.name);

  private _cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly _processService: FingerprintProcessService,
    private readonly _contextService: FingerprintContextService,
    private readonly _contextManager: ContextManagerService,
    private readonly _hookRegistry: HookRegistryService,
    private readonly _responseService: FingerprintResponseService,
    @Inject(FINGERPRINT_SCAN_CONFIG) private readonly _config: IFingerprintScanConfig,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this._processService.startProcess();
    this._setupResponseProcessing();
    this._startPeriodicCleanup();

    this._logger.log('Fingerprint scan service ready');
  }

  public onModuleDestroy(): void {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }

    this._logger.log('Fingerprint scan service shutting down');
  }

  public createContext(config: ContextConfig): FingerprintContextInstance {
    return this._contextService.createContext(config);
  }

  public getGlobalResponses$(): Observable<FingerprintResponse> {
    return this._responseService.getResponses$();
  }

  public getProcessStatus$(): Observable<ProcessStatus> {
    return this._processService.getProcessStatus$();
  }

  public async restartProcess(): Promise<boolean> {
    return this._processService.restartProcess();
  }

  public getHooksInfo(): any {
    return this._hookRegistry.getHooksInfo();
  }

  public clearAllHooks(): void {
    this._hookRegistry.clearResponseHooks();
    this._hookRegistry.clearCommandHooks();
    this._hookRegistry.clearProcessHooks();
    this._hookRegistry.clearErrorHooks();
  }

  public triggerCleanup(): number {
    return this._contextManager.triggerCleanup();
  }

  private _setupResponseProcessing(): void {
    this._responseService.getResponses$().subscribe(async (response) => {
      await this._hookRegistry.processResponse(response);
    });
  }

  private _startPeriodicCleanup(): void {
    const cleanupInterval = this._config.cleanupInterval || 5 * 60 * 1000;

    this._cleanupInterval = setInterval(() => {
      const removedCount = this._contextManager.triggerCleanup();
      if (removedCount > 0) {
        this._logger.log(`Service periodic cleanup removed ${removedCount} expired commands`);
      }
    }, cleanupInterval);

    this._logger.log(`Started service periodic cleanup with interval: ${cleanupInterval}ms`);
  }
}
