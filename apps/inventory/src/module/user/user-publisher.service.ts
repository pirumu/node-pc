import { IAppEvent } from '@common/interfaces';
import { InjectMQTTPublisher, IPublisher } from '@framework/publisher';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserPublisherService {
  constructor(@InjectMQTTPublisher() private readonly _publisher: IPublisher) {}

  public async emit(event: IAppEvent): Promise<void> {
    return this._publisher.publish(event.getChannel(), event.getPayload());
  }
}
