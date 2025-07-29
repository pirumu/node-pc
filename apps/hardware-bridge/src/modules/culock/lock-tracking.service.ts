import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {  Observable, interval, timer, of } from 'rxjs';
import { switchMap, takeUntil, filter, take, catchError, finalize } from 'rxjs/operators';
import { Command, LOCK_STATUS, ProtocolType } from '@culock/protocols';
import { ControlUnitLockService } from '@culock';
import { CuLockRequest } from '@culock/dto';
import { COMMAND_TYPE } from '@common/constants';
import { CuResponse } from '@culock/protocols/cu';
import { ScuResponse } from '@culock/protocols/scu/scu.types';

interface LockMonitorRequest {
  requestId: string;
  deviceType: string;
  deviceId: string;
  lockId: string;
}


@Injectable()
export class LockMonitoringService implements  OnModuleDestroy {
  private readonly _logger = new Logger(LockMonitoringService.name);
  private readonly pollInterval = 3000; // 3s
  private readonly timeoutDuration = 60 * 60 * 1000; // 1h

  constructor(private readonly _controlUnitLockService: ControlUnitLockService) {
  }

  async waitForLockClose(deviceType: string, deviceId: string, lockId: string): Promise<boolean> {
     this._createLockPollingObservable(deviceType, deviceId, lockId)
  }


  private _createLockPollingObservable(deviceType: string, deviceId: string, lockId: string): Observable<boolean> {
    const timeout$ = timer(this.timeoutDuration);

    return interval(this.pollInterval).pipe(
      // Poll lock status service
      switchMap(() => this.checkLockStatus(deviceType, deviceId, lockId)),

      // Filter and process results
      switchMap((results: LockStatusResult[]) => {
        if (results && results.length > 0) {
          const allClosed = results.every((res) => res.status !== LOCK_STATUS.OPEN);
          if (allClosed) {
            this._logger.log(`Lock ${lockId} is now closed`);
            this.publishLockClosedMessage(lockId);
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
            this._logger.warn(`Lock monitoring timeout for ${lockId}`);
            this.publishLockTimeoutMessage(lockId);
            throw new Error(`Lock monitoring timeout after ${this.timeoutDuration}ms`);
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
        this._logger.log(`Lock monitoring finished for ${lockId}`);
      }),
    );
  }


  private async checkLockStatus(protocol: ProtocolType, deviceId: number, lockIds: number[]): Promise<(CuResponse| ScuResponse)[]> {
    try {
      const req = new CuLockRequest({
        path:'',
        protocol,
        command: Command.GET_STATUS,
        deviceId:deviceId,
        lockIds:lockIds
      });
      return await this._controlUnitLockService.execute(req);
    } catch (error) {
      this._logger.error('Error checking lock status:', error);
      return [];
    }
  }

  /**
   * Mock service - replace with your actual lock status API call
   */
  private async mockLockStatusService(deviceType: string, deviceId: string, lockId: string): Promise<LockStatusResult[]> {
    // Simulate API call delay
    await this.wait(100);

    // Mock response - randomly return open/close for demo
    // In reality, this would be your actual API call
    const isOpen = Math.random() > 0.8; // 80% chance of being closed for demo

    return [
      {
        status: isOpen ? 'Open' : 'Close',
        lockId: lockId,
      },
    ];
  }

  /**
   * Publish MQTT message when lock is closed
   */
  private publishLockClosedMessage(lockId: string) {
    if (this.mqttClient?.connected) {
      const message = {
        lockId,
        status: 'closed',
        timestamp: Date.now(),
      };

      this.mqttClient.publish('lock/status/closed', JSON.stringify(message));
      this._logger.log(`Published lock closed message for ${lockId}`);
    }
  }

  /**
   * Publish MQTT message when lock monitoring timeout
   */
  private publishLockTimeoutMessage(lockId: string) {
    if (this.mqttClient?.connected) {
      const message = {
        lockId,
        status: 'timeout',
        timestamp: Date.now(),
      };

      this.mqttClient.publish('lock/status/timeout', JSON.stringify(message));
      this._logger.log(`Published lock timeout message for ${lockId}`);
    }
  }

  /**
   * Replace this with your actual lock status service
   */
  setLockStatusService(statusService: (deviceType: string, deviceId: string, lockId: string) => Promise<LockStatusResult[]>) {
    this.mockLockStatusService = statusService;
  }

  private generateRequestId(): string {
    return `lock_monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  onModuleDestroy() {
    this.
  }
}
