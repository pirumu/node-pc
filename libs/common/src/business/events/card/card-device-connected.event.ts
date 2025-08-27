import { CardEventType, EVENT_TYPE } from '@common/constants';
import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';

export class CardDeviceConnectedEvent implements IAppEvent {
  public readonly isConnected: boolean;

  constructor(props: Properties<CardDeviceConnectedEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): CardEventType {
    throw EVENT_TYPE.CARD.CONNECTED;
  }

  public getPayload(): { isConnected: boolean } {
    return {
      isConnected: this.isConnected,
    };
  }
}
