import { ControlUnitLockService } from '@culock';
import { CuLockRequest } from '@culock/dto';
import { LOCK_STATUS, ProtocolType } from '@culock/protocols';
import { CuResponse } from '@culock/protocols/cu';
import { ScuResponse } from '@culock/protocols/scu/scu.types';
import { PublisherService, Transport } from '@framework/publisher';
import { Injectable, Logger } from '@nestjs/common';
import { Observable, interval, timer, of } from 'rxjs';
import { switchMap, takeUntil, filter, take, catchError, finalize } from 'rxjs/operators';

@Injectable()
export class LockMonitoringService {
  private readonly _logger = new Logger(LockMonitoringService.name);
  private readonly _pollInterval = 1000; // 3s
  private readonly _timeoutDuration = 60 * 60 * 1000; // 1h

  constructor(
    private readonly _publisherService: PublisherService,
    private readonly _controlUnitLockService: ControlUnitLockService,
  ) {}

  public async track(request: CuLockRequest): Promise<void> {
    this._createLockPollingObservable(request).subscribe({
      next: (status) => {
        this._publisherService.publish(Transport.MQTT, 'lock-tracking/status', { status }).catch((err) => {
          this._logger.error(`Failed to publish tracking status`, {
            message: err.message,
            name: err.name,
            stack: err.stack,
          });
        });
      },
      error: (err: Error) => {
        if (err.message.includes('Lock monitoring timeout')) {
          this._publisherService
            .publish(Transport.MQTT, 'lock-tracking/status', {
              status: false,
              error: 'timeout',
            })
            .catch((err) => {
              this._logger.error(`Failed to publish tracking status`, {
                message: err.message,
                name: err.name,
                stack: err.stack,
              });
            });
        }
        this._logger.error(`Failed to publish tracking status`, {
          message: err.message,
          name: err.name,
          stack: err.stack,
        });
      },
      complete: () => {},
    });
  }

  private _createLockPollingObservable(request: CuLockRequest): Observable<boolean> {
    const timeout$ = timer(this._timeoutDuration);

    return interval(this._pollInterval).pipe(
      // Poll lock status service
      switchMap(async () => this._checkLockStatus(request)),

      // Filter and process results
      switchMap((result: CuResponse | ScuResponse | null) => {
        if (result) {
          return of(null);
        }
        if (request.protocol === ProtocolType.CU) {
          const lockStatuses = (result as unknown as CuResponse).lockStatuses;
          const isClosed = Object.values(lockStatuses).every((status) => status !== LOCK_STATUS.OPENED);
          if (isClosed) {
            this._logger.log(`Lock ${request.lockIds} is now closed`);
            return of(true);
          }
        }

        if (request.protocol === ProtocolType.SCU) {
          const lockStatuses = (result as unknown as ScuResponse).lockStatus;
          const isClosed = lockStatuses !== LOCK_STATUS.OPENED;
          if (isClosed) {
            this._logger.log(`Lock ${request.lockIds} is now closed`);
            return of(true);
          }
        }

        return of(null);
      }),

      // Stop when we get a result or timeout
      filter((result) => result !== null),
      take(1),

      // Handle timeout
      takeUntil(
        timeout$.pipe(
          switchMap(() => {
            this._logger.warn(`Lock monitoring timeout for ${request.lockIds}`);
            throw new Error(`Lock monitoring timeout after ${this._timeoutDuration}ms`);
          }),
        ),
      ),

      // Error handling
      catchError((error) => {
        this._logger.error('Lock monitoring error:', error);
        throw error;
      }),

      // Cleanup
      finalize(() => {
        this._logger.log(`Lock monitoring finished for ${request.lockIds}`);
      }),
    );
  }

  private async _checkLockStatus(request: CuLockRequest): Promise<CuResponse | ScuResponse | null> {
    try {
      return (await this._controlUnitLockService.execute(request)) as CuResponse | ScuResponse;
    } catch (error) {
      this._logger.error('Error checking lock status:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return null;
    }
  }
}
