import { EVENT_TYPE, LoadcellEventType } from '@common/constants';
import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';
import { Expose, Type } from 'class-transformer';

export class StopReadingEvent implements IAppEvent {
  @Type(() => Array<number>)
  @Expose()
  hardwareIds: number[];

  constructor(props: Properties<StopReadingEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): LoadcellEventType {
    return EVENT_TYPE.LOADCELL.STOP_READING;
  }

  public getPayload(): Properties<StopReadingEvent> {
    return {
      hardwareIds: this.hardwareIds,
    };
  }
}
