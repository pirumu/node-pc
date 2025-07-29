import { Inject, Injectable, Logger } from '@nestjs/common';

import { FINGERPRINT_CMD } from '../enums/fingerprint.enum';
import { FINGERPRINT_SCAN_CONFIG } from '../fingerprint-scan.constants';
import { IFingerprintScanConfig } from '../interfaces/config.interface';
import { CommandResult } from '../interfaces/response.interface';

import { FingerprintProcessService } from './fingerprint-process.service';
import { HookRegistryService } from './hook-registry.service';

@Injectable()
export class FingerprintCommandService {
  private readonly _logger = new Logger(FingerprintCommandService.name);

  constructor(
    private readonly _processService: FingerprintProcessService,
    private readonly _hookRegistry: HookRegistryService,
    @Inject(FINGERPRINT_SCAN_CONFIG) private readonly _config: IFingerprintScanConfig,
  ) {}

  public async sendCommand(command: FINGERPRINT_CMD, context: string = 'command', correlationId?: string): Promise<CommandResult> {
    const commandStr = command.toString();
    this._logger.debug(`Sending command ${commandStr} (${context})`);

    if (!this._processService.isProcessRunning()) {
      throw new Error('Process not running');
    }

    try {
      const isSuccess = await this._processService.sendCommand(commandStr);

      const result: CommandResult = {
        success: isSuccess,
        commandSent: new Date(),
        command,
        correlationId,
        error: isSuccess ? undefined : 'Failed to send command to process',
      };

      await this._hookRegistry.processCommandResult(result, correlationId);
      return result;
    } catch (error: any) {
      this._logger.error(`Failed to send command ${commandStr}:`, error);

      const result: CommandResult = {
        success: false,
        commandSent: new Date(),
        command,
        correlationId,
        error: error.message,
      };

      await this._hookRegistry.processCommandResult(result, correlationId);
      await this._hookRegistry.processError(error, `command_${context}`);

      return result;
    }
  }

  public async sendCommandWithRetry(command: FINGERPRINT_CMD, context: string = 'command'): Promise<CommandResult> {
    let lastResult: CommandResult;
    const maxAttempts = this._config.retryAttempts || 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptContext = `${context}_attempt_${attempt}`;
      lastResult = await this.sendCommand(command, attemptContext);

      if (lastResult.success) {
        return lastResult;
      }

      if (attempt < maxAttempts) {
        this._logger.warn(`Command ${command} failed, retrying... (${attempt}/${maxAttempts})`);
        await this._delay(1000 * attempt);
      }
    }

    this._logger.error(`Command ${command} failed after ${maxAttempts} attempts`);
    return {
      ...lastResult!,
      // @ts-ignore
      error: `Failed after ${maxAttempts} attempts: ${lastResult?.error}`,
    };
  }

  public canSendCommands(): boolean {
    return this._processService.isProcessRunning();
  }

  private async _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
