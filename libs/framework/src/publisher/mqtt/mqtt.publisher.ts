import { TRACING_ID } from '@framework/constants';
import { MQTTPublishOptions } from '@framework/publisher/mqtt/mqtt.types';
import { Logger } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, MqttRecordBuilder, Transport } from '@nestjs/microservices';
import { ClsServiceManager } from 'nestjs-cls';

import { IPublisher } from '../publisher.types';

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
    const record = new MqttRecordBuilder(data)
      .setProperties({ userProperties: { [TRACING_ID]: ClsServiceManager.getClsService().getId(), ...metadata } })
      .setQoS(2)
      .build();

    return this._client.send(channel, record).subscribe({
      complete: () => {
        this._logger.log('MQTTPublisher published successfully', {
          event: record,
        });
      },
      error: (e) => {
        this._logger.error('MQTTPublisher published failed with error', {
          error: e,
          event: record,
        });
      },
    });
  }
}
