import { EVENT_TYPE, LoadcellEventType } from '@common/constants';
import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';
import { Expose, Type } from 'class-transformer';

export class StartReadingEvent implements IAppEvent {
  @Type(() => Array<number>)
  @Expose()
  hardwareIds: number[];

  @Type(() => Boolean)
  @Expose()
  forceReset?: boolean;

  constructor(props: Properties<StartReadingEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): LoadcellEventType {
    return EVENT_TYPE.LOADCELL.START_READING;
  }

  public getPayload(): Properties<StartReadingEvent> {
    return {
      hardwareIds: this.hardwareIds,
      forceReset: !!this.forceReset,
    };
  }
}
