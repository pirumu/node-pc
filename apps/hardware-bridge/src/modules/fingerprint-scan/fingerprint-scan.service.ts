import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { IContextualResponse, FINGERPRINT_CMD, FingerprintScanService, FingerprintContextInstance } from '@fingerprint-scanner';
import { Inject, Injectable, InternalServerErrorException, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { lastValueFrom, timeout } from 'rxjs';

import { IFingerprintRepository } from './repositories';

@Injectable()
export class FingerprintService implements OnModuleInit, OnModuleDestroy {
  private static _verificationTimeout = 5000; // 5s

  private readonly _logger = new Logger(FingerprintService.name);
  private _fingerprintContext: FingerprintContextInstance;
  constructor(
    @Inject() private readonly _repository: IFingerprintRepository,
    private readonly _fingerprintScanService: FingerprintScanService,
  ) {}

  public onModuleInit(): void {
    this._fingerprintScanService.getProcessStatus$().subscribe({
      next: (r) => {
        this._logger.log('Fingerprint Scanner Status', r);
      },
      error: (err) => this._logger.error('Fingerprint Scanner Error', err),
      complete: () => {
        this._logger.log('Fingerprint Scanner Complete');
      },
    });

    this._fingerprintContext = this._fingerprintScanService.createContext({
      name: FingerprintService.name,
      isolated: true,
      autoCleanup: true,
    });
  }

  public onModuleDestroy(): void {
    this._fingerprintContext?.destroy();
  }

  public async verify(): Promise<IContextualResponse> {
    const startTime = Date.now();
    try {
      const verifyData = await this._getVerificationData();
      await this._prepareVerificationFile('/', verifyData);
      return this._executeVerification();
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logger.error(`Fingerprint authentication failed after ${duration}ms`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async _getVerificationData(): Promise<string> {
    try {
      const entities = await this._repository.findAll();
      return entities.map((finger) => finger.objectId + finger.feature).join('');
    } catch (error) {
      this._logger.error('Failed to create fingerprint verification data', error);
      throw new InternalServerErrorException('Unable to prepare fingerprint data');
    }
  }

  private async _prepareVerificationFile(savePath: string, data: string, fileName = 'data.txt'): Promise<void> {
    const fullPath = path.join(process.cwd(), savePath, fileName);
    try {
      await fs.writeFile(fullPath, data, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save fingerprint file: ${fullPath}`, {
        cause: error.cause,
      });
    }
  }

  private async _executeVerification(): Promise<IContextualResponse> {
    try {
      const sendResult = await this._fingerprintContext.sendCommandWithRetry(FINGERPRINT_CMD.VERIFY);

      this._logger.log('Sending verification command result', sendResult);

      return lastValueFrom(this._fingerprintContext.getResponses$().pipe(timeout(FingerprintService._verificationTimeout)));
    } catch (error) {
      this._logger.warn(`Fingerprint verification failed `, error);
      throw new InternalServerErrorException('Fingerprint verification system unavailable', error);
    }
  }
}
