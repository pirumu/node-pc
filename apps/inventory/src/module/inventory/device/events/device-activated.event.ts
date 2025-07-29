import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';

import { EVENT_TYPE } from '../../../../common/events';

export class DeviceActivatedEvent implements IAppEvent {
  public readonly deviceId: string;
  public readonly deviceNumId: number;

  constructor(props: Properties<DeviceActivatedEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): string {
    return EVENT_TYPE.DEVICE_ACTIVATED;
  }

  public getPayload(): { deviceId: string; deviceNumId: number } {
    return {
      deviceId: this.deviceId,
      deviceNumId: this.deviceNumId,
    };
  }
}
