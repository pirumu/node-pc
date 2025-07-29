import { ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

import { sleep } from '@framework/time/sleep';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject, BehaviorSubject, EMPTY } from 'rxjs';
import { takeUntil, tap, catchError, share } from 'rxjs/operators';

import { FINGERPRINT_SCAN_CONFIG } from '../fingerprint-scan.constants';
import { IFingerprintScanConfig } from '../interfaces/config.interface';
import { ProcessEvent } from '../interfaces/response.interface';
import { spawnObservableWithProcess, SpawnObservableResult } from '../utils/spawn-observable.util';

import { HookRegistryService } from './hook-registry.service';

enum ProcessState {
  IDLE = 'IDLE',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
}

export type ProcessStatus = {
  isRunning: boolean;
  pid?: number;
  startTime?: Date;
  lastActivity?: Date;
  restartCount: number;
  state: ProcessState;
};

@Injectable()
export class FingerprintProcessService implements OnModuleDestroy {
  private readonly _logger = new Logger(FingerprintProcessService.name);

  private _destroy$ = new Subject<void>();
  private _processStatus$ = new BehaviorSubject<ProcessStatus>({
    isRunning: false,
    restartCount: 0,
    state: ProcessState.IDLE,
  });

  private _processObservable$: Observable<SpawnObservableResult> | null = null;
  private _currentProcess: ChildProcessWithoutNullStreams | null = null;
  private _isStoppingIntentionally = false;

  constructor(
    private readonly _hookRegistry: HookRegistryService,
    @Inject(FINGERPRINT_SCAN_CONFIG) private readonly _config: IFingerprintScanConfig,
  ) {}

  public async startProcess(): Promise<boolean> {
    const currentState = this._processStatus$.value.state;
    if (currentState === ProcessState.STARTING || currentState === ProcessState.RUNNING) {
      this._logger.warn(`Process is already ${currentState.toLowerCase()}.`);
      return currentState === ProcessState.RUNNING;
    }

    this._updateProcessStatus({ state: ProcessState.STARTING });

    try {
      this._logger.log('Starting fingerprint process...');

      const binaryPath = path.resolve(this._config.binaryPath);
      const args = [this._config.devicePort];

      if (this._processObservable$) {
        this._destroy$.next();
        this._destroy$ = new Subject<void>();
      }

      const { observable$, childProcess } = spawnObservableWithProcess(
        binaryPath,
        args,
        {
          logOutput: this._config.logLevel === 'debug',
          logErrors: this._config.logLevel !== 'none',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
        FingerprintProcessService.name,
      );

      this._currentProcess = childProcess;

      this._processObservable$ = observable$.pipe(
        tap(async (result) => this._handleProcessResult(result)),
        catchError((error) => {
          this._handleProcessError(error);
          return EMPTY;
        }),
        takeUntil(this._destroy$),
        share(),
      );

      this._processObservable$.subscribe({
        next: () => {},
        error: async (error) => this._handleProcessError(error),
        complete: async () => this._handleProcessComplete(),
      });

      this._updateProcessStatus({
        isRunning: true,
        startTime: new Date(),
        lastActivity: new Date(),
        state: ProcessState.RUNNING,
        pid: childProcess.pid,
      });

      this._logger.log(`Fingerprint process started successfully with PID: ${childProcess.pid}`);
      return true;
    } catch (error) {
      this._logger.error('Failed to start fingerprint process:', error);
      await this._hookRegistry.processError(error, 'process_start');
      this._updateProcessStatus({
        isRunning: false,
        state: ProcessState.ERROR,
      });
      return false;
    }
  }

  public async stopProcess(): Promise<void> {
    const currentState = this._processStatus$.value.state;
    if (currentState === ProcessState.IDLE || currentState === ProcessState.STOPPING) {
      this._logger.warn(`Process is not running or already stopping. Current state: ${currentState}`);
      return;
    }

    this._isStoppingIntentionally = true;
    this._updateProcessStatus({ state: ProcessState.STOPPING });

    try {
      this._logger.log('Stopping fingerprint process...');

      if (this._currentProcess && !this._currentProcess.killed) {
        this._currentProcess.kill('SIGTERM');

        setTimeout(() => {
          if (this._currentProcess && !this._currentProcess.killed) {
            this._logger.warn('Process did not terminate gracefully, sending SIGKILL');
            this._currentProcess.kill('SIGKILL');
          }
        }, 5000);
      }

      this._updateProcessStatus({
        isRunning: false,
        pid: undefined,
        state: ProcessState.STOPPED,
      });

      this._currentProcess = null;
      this._logger.log('Fingerprint process stopped');
    } catch (error) {
      this._logger.error('Error stopping process:', error);
      await this._hookRegistry.processError(error, 'process_stop');
      this._updateProcessStatus({ state: ProcessState.ERROR });
    }
  }

  public async restartProcess(): Promise<boolean> {
    this._logger.log('Restarting fingerprint process...');
    await this.stopProcess();
    await sleep(1000);

    const isSuccess = await this.startProcess();

    if (isSuccess) {
      const status = this._processStatus$.value;
      this._updateProcessStatus({ restartCount: status.restartCount + 1 });
    }

    return isSuccess;
  }

  public async sendCommand(command: string): Promise<boolean> {
    if (!this.isProcessRunning()) {
      throw new Error('Process not running');
    }
    if (!this._currentProcess || !this._currentProcess.stdin.writable) {
      throw new Error('Process stdin not writable');
    }

    try {
      this._currentProcess.stdin.write(`${command}\n`);
      this._updateProcessStatus({ lastActivity: new Date() });
      return true;
    } catch (error) {
      this._logger.error(`Failed to send command ${command}:`, error);
      await this._hookRegistry.processError(error, 'command_send');
      return false;
    }
  }

  public getProcessStatus(): ProcessStatus {
    return this._processStatus$.value;
  }

  public getProcessStatus$(): Observable<ProcessStatus> {
    return this._processStatus$.asObservable();
  }

  public isProcessRunning(): boolean {
    return this._processStatus$.value.state === ProcessState.RUNNING;
  }

  public async onModuleDestroy(): Promise<void> {
    this._destroy$.next();
    this._destroy$.complete();
    await this.stopProcess();
  }

  private async _handleProcessResult(result: SpawnObservableResult): Promise<void> {
    const processEvent: ProcessEvent = {
      type: result.type,
      data: result.data,
      timestamp: result.timestamp,
    };

    this._updateProcessStatus({ lastActivity: new Date() });
    await this._hookRegistry.processProcessEvent(processEvent);
  }

  private async _handleProcessError(error: any): Promise<void> {
    this._logger.error('Process error:', error);
    this._updateProcessStatus({
      isRunning: false,
      pid: undefined,
      state: ProcessState.ERROR,
    });

    this._currentProcess = null;
    await this._hookRegistry.processError(error, 'process_error');

    if (this._config.autoRestart && !this._isStoppingIntentionally) {
      const count = this._processStatus$.value.restartCount;
      const delay = Math.min(30000, 2000 * Math.pow(2, count));

      this._logger.log(`Auto-restarting process in ${delay}ms (attempt ${count + 1})`);
      setTimeout(async () => this.restartProcess(), delay);
    }
  }

  private async _handleProcessComplete(): Promise<void> {
    this._logger.log('Process completed');
    this._updateProcessStatus({
      isRunning: false,
      pid: undefined,
      state: ProcessState.STOPPED,
    });

    this._currentProcess = null;

    if (!this._isStoppingIntentionally) {
      await this._hookRegistry.processError(new Error('Process completed unexpectedly'), 'process_complete');

      if (this._config.autoRestart) {
        const count = this._processStatus$.value.restartCount;
        const delay = Math.min(30000, 2000 * Math.pow(2, count));
        this._logger.log(`Auto-restarting process in ${delay}ms`);
        setTimeout(async () => this.restartProcess(), delay);
      }
    }

    this._isStoppingIntentionally = false;
  }

  private _updateProcessStatus(updates: Partial<ProcessStatus>): void {
    const current = this._processStatus$.value;
    this._processStatus$.next({ ...current, ...updates });
  }
}
