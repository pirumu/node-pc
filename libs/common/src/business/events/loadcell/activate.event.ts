import { EVENT_TYPE, LoadcellEventType } from '@common/constants';
import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';
import { Expose, Type } from 'class-transformer';

export class ActivateLoadCellEvent implements IAppEvent {
  @Type(() => Array<number>)
  @Expose()
  hardwareIds: number[];

  constructor(props: Properties<ActivateLoadCellEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): LoadcellEventType {
    return EVENT_TYPE.LOADCELL.ACTIVATE;
  }

  public getPayload(): Properties<ActivateLoadCellEvent> {
    return {
      hardwareIds: this.hardwareIds,
    };
  }
}
