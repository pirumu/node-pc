import { TRACING_ID } from '@framework/constants';
import { MQTTPublishOptions } from '@framework/publisher/mqtt/mqtt.types';
import { SnowflakeId } from '@framework/snowflake';
import { Logger } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, MqttRecordBuilder, Transport } from '@nestjs/microservices';
import { ClsServiceManager } from 'nestjs-cls';

import { IPublisher } from '../publisher.types';
import { firstValueFrom, lastValueFrom } from 'rxjs';

export class MQTTPublisher implements IPublisher {
  private readonly _logger = new Logger(MQTTPublisher.name);
  private readonly _client: ClientProxy;

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

    const isSync = options?.async === undefined ? true : options?.async;
    if (isSync) {
      return this._client.send(channel, record);
    }
    return this._client.emit(channel, record);
  }
}
