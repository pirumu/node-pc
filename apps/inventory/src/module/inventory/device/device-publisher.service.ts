import { IAppEvent } from '@common/interfaces';
import { PublisherService, Transport } from '@framework/publisher';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class DevicePublisherService {
  constructor(private readonly _publisher: PublisherService) {}

  public async emit(event: IAppEvent): Promise<void> {
    return this._publisher.publish(Transport.MQTT, event.getChannel(), event.getPayload());
  }
}
