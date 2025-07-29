import { Properties } from '@framework/types';

import { EVENT_TYPE } from '../../../constants';
import { IAppEvent } from '../../../interfaces';

export class CardDeviceConnectedEvent implements IAppEvent {
  public readonly isConnected: boolean;

  constructor(props: Properties<CardDeviceConnectedEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): string {
    throw EVENT_TYPE.CARD_DEVICE_CONNECTED;
  }

  public getPayload(): { isConnected: boolean } {
    return {
      isConnected: this.isConnected,
    };
  }
}
