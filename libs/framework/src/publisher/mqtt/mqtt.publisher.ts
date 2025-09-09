import { TRACING_ID } from '@framework/constants';
import { MQTTPublishOptions } from '@framework/publisher/mqtt/mqtt.types';
import { SnowflakeId } from '@framework/snowflake';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, MqttRecordBuilder, Transport } from '@nestjs/microservices';
import { ClsServiceManager } from 'nestjs-cls';
import { EMPTY, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

import { IPublisher } from '../publisher.types';

export class MQTTPublisher implements IPublisher, OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(MQTTPublisher.name);
  private readonly _client: ClientProxy;

  public async onModuleInit(): Promise<void> {
    this._setupGlobalErrorHandlers();

    try {
      await this._client.connect();
      this._logger.log('MQTT client connected successfully');
    } catch (error) {
      this._logger.error('MQTT connection failed:', error);
    }
  }

  constructor(options: MQTTPublishOptions) {
    this._client = ClientProxyFactory.create({
      transport: Transport.MQTT,
      options: { ...options, protocolVersion: 5 },
    });
  }

  public publish(channel: string, data: Record<string, unknown>, metadata?: Record<string, string | string[]>, options?: any): any {
    const requestId = ClsServiceManager.getClsService().getId();
    const record = new MqttRecordBuilder(data)
      .setProperties({ userProperties: { [TRACING_ID]: requestId || new SnowflakeId().id(), ...(metadata || {}) } })
      .setQoS(0)
      .build();

    const isSync = options?.async === undefined ? true : !options?.async;

    if (isSync) {
      return this._client
        .send(channel, record)
        .pipe(
          timeout(10000),
          catchError((error) => {
            this._logDetailedError('MQTT send error', error, channel);
            return of(null);
          }),
        )
        .subscribe({
          next: (data) => data,
          error: (error) => {
            this._logDetailedError('MQTT send subscription error', error, channel);
          },
        });
    }

    return this._client
      .emit(channel, record)
      .pipe(
        timeout(10000),
        catchError((error) => {
          this._logDetailedError('MQTT emit error', error, channel);
          return EMPTY;
        }),
      )
      .subscribe({
        error: (error) => {
          this._logDetailedError('MQTT emit subscription error', error, channel);
        },
        complete: () => {
          this._logger.debug(`MQTT emit completed for channel: ${channel}`);
        },
      });
  }

  private _logDetailedError(context: string, error: any, channel?: string): void {
    this._logger.error(`=== ${context.toUpperCase()} ===`);
    if (channel) {
      this._logger.error(`Channel: ${channel}`);
    }
    this._logger.error(`Error type: ${typeof error}`);
    this._logger.error(`Error constructor: ${error?.constructor?.name || 'Unknown'}`);
    this._logger.error(`Error message: ${error?.message || 'No message'}`);
    this._logger.error(`Error code: ${error?.code || 'No code'}`);
    this._logger.error(`Error stack: ${error?.stack || 'No stack'}`);

    if (typeof error === 'object' && error !== null) {
      const keys = Object.keys(error);
      this._logger.error(`Error keys: [${keys.join(', ')}]`);
      if (keys.length === 0) {
        this._logger.error('EMPTY ERROR OBJECT DETECTED - This may be from RxJS internal error');
      }
      try {
        this._logger.error(`Full error object: ${JSON.stringify(error, null, 2)}`);
      } catch (jsonError) {
        this._logger.error('Cannot stringify error object:', jsonError);
      }
    }
    this._logger.error(`=== END ${context.toUpperCase()} ===`);
  }

  private _setupGlobalErrorHandlers(): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('rxjs').config.onUnhandledError = (err: any) => {
      this._logDetailedError('RxJS Unhandled Error (caught)', err);
    };
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this._client.close();
      this._logger.log('MQTT client closed successfully');
    } catch (error) {
      this._logger.error('Error closing MQTT client:', error);
    }
  }
}
