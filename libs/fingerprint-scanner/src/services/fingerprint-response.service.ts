import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

import { FINGERPRINT_RESPONSE_ID } from '../enums/fingerprint.enum';
import { FingerprintResponse, ProcessEvent } from '../interfaces/response.interface';

import { HookRegistryService } from './hook-registry.service';

@Injectable()
export class FingerprintResponseService implements OnModuleInit {
  private readonly _logger = new Logger(FingerprintResponseService.name);

  private _destroy$ = new Subject<void>();
  private _responses$ = new Subject<FingerprintResponse>();

  private _jsonBuffer = '';

  constructor(private readonly _hookRegistry: HookRegistryService) {}

  public onModuleInit(): void {
    this._setupProcessEventHandler();
  }

  public onModuleDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._responses$.complete();
  }

  public getResponses$(): Observable<FingerprintResponse> {
    return this._responses$.asObservable();
  }

  public getSuccessResponses$(): Observable<FingerprintResponse> {
    return this._responses$.pipe(filter((response) => response.id === FINGERPRINT_RESPONSE_ID.SUCCESS_REGISTER));
  }

  public getErrorResponses$(): Observable<FingerprintResponse> {
    return this._responses$.pipe(
      filter((response) => [FINGERPRINT_RESPONSE_ID.ERROR_CONNECT, FINGERPRINT_RESPONSE_ID.ERROR_REGISTER].includes(response.id)),
    );
  }

  public getResponsesById$(responseId: FINGERPRINT_RESPONSE_ID): Observable<FingerprintResponse> {
    return this._responses$.pipe(filter((response) => response.id === responseId));
  }

  private _setupProcessEventHandler(): void {
    this._hookRegistry.registerProcessHook({
      id: 'response_parser',
      handler: async (event: ProcessEvent) => {
        if (event.type === 'stderr') {
          await this._parseStderrData(event.data as string, event.timestamp);
        }
      },
      eventTypes: ['stderr'],
      priority: 1000,
      persistent: true,
    });
  }

  private async _parseStderrData(data: string, timestamp: Date): Promise<void> {
    try {
      const lines = data.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }

        this._jsonBuffer += trimmedLine;

        try {
          const parsed = JSON.parse(this._jsonBuffer);

          if (parsed.id !== undefined && this._isValidResponseId(parsed.id)) {
            const response: FingerprintResponse = {
              id: parsed.id as FINGERPRINT_RESPONSE_ID,
              data: parsed.data || '',
              timestamp,
            };

            this._logger.debug(`Parsed response: ID=${response.id}, Data=${response.data.substring(0, 50)}`);

            this._responses$.next(response);
            await this._hookRegistry.processResponse(response);

            this._jsonBuffer = '';
          } else {
            this._logger.warn(`Invalid response format: ${this._jsonBuffer}`);
            this._jsonBuffer = '';
          }
        } catch (parseError) {
          if (parseError instanceof SyntaxError) {
            if (parseError.message.includes('Unexpected end of JSON input')) {
              continue; // incomplete JSON, accumulate
            } else {
              this._logger.debug(`Malformed JSON in stderr: ${this._jsonBuffer}`);
              this._jsonBuffer = '';
            }
          } else {
            this._logger.error('Unexpected JSON parsing error:', parseError);
            this._jsonBuffer = '';
          }
        }

        if (this._jsonBuffer.length > 10000) {
          this._logger.warn('JSON buffer too large, clearing');
          this._jsonBuffer = '';
        }
      }
    } catch (error) {
      this._logger.error('Error parsing stderr data:', error);
      await this._hookRegistry.processError(error, 'response_parse');
      this._jsonBuffer = '';
    }
  }

  private _isValidResponseId(id: number): boolean {
    return Object.values(FINGERPRINT_RESPONSE_ID).includes(id as FINGERPRINT_RESPONSE_ID);
  }
}
