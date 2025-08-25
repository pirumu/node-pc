import { Properties } from '@framework/types';

import { EVENT_TYPE, CardEventType } from '../../../constants';
import { IAppEvent } from '../../../interfaces';

export class CardScannedEvent implements IAppEvent {
  public readonly value: string;

  constructor(props: Properties<CardScannedEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): CardEventType {
    throw EVENT_TYPE.CARD.SCANNED;
  }

  public getPayload(): Properties<CardScannedEvent> {
    return {
      value: this.value,
    };
  }
}
