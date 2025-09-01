import { EVENT_TYPE, CardEventType } from '@common/constants';
import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';
import { Expose, Type } from 'class-transformer';

export class CardScannedEvent implements IAppEvent {
  @Type(() => String)
  @Expose()
  public value: string;

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
