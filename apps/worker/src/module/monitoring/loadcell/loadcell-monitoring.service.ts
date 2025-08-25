import { LoadcellHeartbeatEvent } from '@common/business/events/loadcell';
import { CONFIG_KEY } from '@config/core';
import { DeviceEntity } from '@entity';
import { PublisherService, Transport } from '@framework/publisher';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { addSeconds, isAfter } from 'date-fns';

// import { LoadcellMonitoringConfig } from '../../../config';

import { ILoadcellRepository, LOADCELL_REPOSITORY_TOKEN } from './repositories';

@Injectable()
export class LoadCellMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly _jobName = 'LoadCellMonitoringCronJob';

  private readonly _logger = new Logger(LoadCellMonitoringService.name);
  constructor(
    @Inject(LOADCELL_REPOSITORY_TOKEN)
    private readonly _repository: ILoadcellRepository,
    private readonly _schedulerRegistry: SchedulerRegistry,
    private readonly _configService: ConfigService,
    private readonly _publisherService: PublisherService,
  ) {}

  public onModuleInit(): void {
    this._registerJob(this._jobName);
  }

  public onModuleDestroy(): void {
    this._schedulerRegistry.deleteCronJob(this._jobName);
  }

  private _registerJob(name: string): void {
    const config = this._configService.getOrThrow<any>(CONFIG_KEY.LOADCELL_MONITORING);

    const job = new CronJob<null, null>(`${config.priorityInSecond} * * * * *`, () => {
      this._logger.log(`time (${config.priorityInSecond}) for job ${name} to run!`);
      this._checkDevicesStatus(config.heartbeatTimeoutSeconds)
        .then(async (heartbeatResults) => {
          for (const heartbeatResult of heartbeatResults) {
            const { device, isConnected, timestamp } = heartbeatResult;

            const event = new LoadcellHeartbeatEvent({
              id: device.id,
              deviceId: device.deviceNumId,
              isConnected: isConnected,
              timestamp: timestamp,
            });
            await this._publisherService.publish(Transport.MQTT, event.getChannel(), event.getPayload());
          }
        })
        .catch((err) => {
          this._logger.error(`Error when heartbeat loadcell device`, JSON.parse(JSON.stringify(err)));
          this._logger.error(err);
        });
    });

    this._schedulerRegistry.addCronJob(name, job);
  }

  private async _checkDevicesStatus(
    heartbeatTimeoutSeconds: number = 10,
  ): Promise<Array<{ device: DeviceEntity; isConnected: boolean; timestamp: number }>> {
    const devices = await this._repository.findAll();
    const currentHeartbeatTime = Date.now();

    return devices.map((device) => ({
      device,
      isConnected: this._isAlive(device, currentHeartbeatTime, heartbeatTimeoutSeconds),
      timestamp: currentHeartbeatTime,
    }));
  }

  private _isAlive(device: DeviceEntity, currentHeartbeatTime: number, heartbeatTimeoutSeconds: number): boolean {
    if (device.heartbeat === undefined) {
      return false;
    }
    const lastHeartbeatTime = new Date(device.heartbeat);
    const timeoutTime = addSeconds(lastHeartbeatTime, heartbeatTimeoutSeconds);
    return isAfter(timeoutTime, new Date(currentHeartbeatTime));
  }
}
