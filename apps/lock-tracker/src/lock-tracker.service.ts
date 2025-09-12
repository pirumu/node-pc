import { EVENT_TYPE } from '@common/constants';
import { CuLockRequest } from '@culock/dto';
import { LOCK_STATUS, ProtocolType } from '@culock/protocols';
import { CuResponse } from '@culock/protocols/cu';
import { ScuResponse } from '@culock/protocols/scu/scu.types';
import { PublisherService, Transport } from '@framework/publisher';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Observable, interval, of, Subscription, EMPTY } from 'rxjs';
import { switchMap, filter, take, catchError, finalize, timeout } from 'rxjs/operators';

@Injectable()
export class LockTrackerService implements OnModuleDestroy {
  private readonly _logger = new Logger(LockTrackerService.name);
  private readonly _pollInterval = 1500; // 1s
  private readonly _timeoutDuration = 60 * 60 * 1000; // 1h

  private readonly _activeMonitors = new Map<number, Subscription>();

  constructor(private readonly _publisherService: PublisherService) {}

  public track(request: CuLockRequest): void {
    const deviceId = request.deviceId;

    if (this._activeMonitors.has(deviceId)) {
      this._logger.log(`Stopping existing monitor for device ${deviceId} before starting a new one.`);
      this._activeMonitors.get(deviceId)?.unsubscribe();
    }

    const monitorSubscription = this._createLockPollingObservable(request).subscribe({
      next: (isClosed) => {
        this._logger.log(`Lock for device ${deviceId} is now closed. Publishing status.`);
        this._publishStatus(deviceId, isClosed);
      },
      error: (err) => {
        this._logger.error(`Error during lock monitoring for device ${deviceId}:`, err.message);
        if (err.name === 'TimeoutError') {
          this._publishStatus(deviceId, false, 'timeout');
        }
      },
    });
    this._activeMonitors.set(deviceId, monitorSubscription);
  }

  public onModuleDestroy(): void {
    this._logger.log('Stopping all active lock monitors...');
    this._activeMonitors.forEach((sub) => sub.unsubscribe());
    this._activeMonitors.clear();
  }

  private _createLockPollingObservable(request: CuLockRequest): Observable<boolean> {
    return interval(this._pollInterval).pipe(
      switchMap(async () => this._checkLockStatus(request)),
      filter((result): result is CuResponse | ScuResponse => result !== null),
      switchMap((result) => {
        const isClosed = this._isLockClosed(result, request.protocol);
        return isClosed ? of(true) : EMPTY;
      }),
      take(1),
      timeout(this._timeoutDuration),
      catchError((error) => {
        throw error;
      }),
      finalize(() => {
        this._logger.log(`Lock monitoring finished for device ${request.deviceId}.`);
        this._activeMonitors.delete(request.deviceId);
      }),
    );
  }

  private _isLockClosed(result: CuResponse | ScuResponse, protocol: ProtocolType): boolean {
    if (protocol === ProtocolType.CU) {
      const lockStatuses = (result as CuResponse).lockStatuses;
      return Object.values(lockStatuses).every((status) => status !== LOCK_STATUS.OPENED);
    }
    if (protocol === ProtocolType.SCU) {
      const lockStatus = (result as ScuResponse).lockStatus;
      return lockStatus !== LOCK_STATUS.OPENED;
    }
    return false;
  }

  private async _checkLockStatus(request: CuLockRequest): Promise<CuResponse | ScuResponse | null> {
    try {
      const res = await this._publisherService.publish<CuResponse>(Transport.TCP, EVENT_TYPE.LOCK.STATUS, request);
      if (request.protocol === ProtocolType.CU) {
        return res as unknown as CuResponse;
      }
      return res as unknown as ScuResponse;
    } catch (error) {
      this._logger.error(`Error checking lock status for device ${request.deviceId}:`, error.message);
      return null;
    }
  }

  private _publishStatus(deviceId: number, isClosed: boolean, error?: string): void {
    const payload: { cuLockId: number; isClosed: boolean; error?: string } = {
      cuLockId: deviceId,
      isClosed,
    };
    if (error) {
      payload.error = error;
    }

    this._publisherService.publish(Transport.MQTT, EVENT_TYPE.LOCK.TRACKING_STATUS, payload, {}, { async: true }).catch((err) => {
      this._logger.error(`Failed to publish tracking status for device ${deviceId}`, err);
    });
  }
}
