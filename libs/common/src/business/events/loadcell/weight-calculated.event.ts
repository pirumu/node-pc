import { EVENT_TYPE, LoadcellEventType } from '@common/constants';
import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';
import { Expose, Type } from 'class-transformer';

export class WeightCalculatedEvent implements IAppEvent {
  @Type(() => String)
  @Expose()
  portPath: string;

  @Type(() => Number)
  @Expose()
  hardwareId: number;

  @Type(() => String)
  @Expose()
  weight: number;

  @Type(() => String)
  @Expose()
  status: string;

  @Type(() => String)
  @Expose()
  timestamp: string;

  constructor(props: Properties<WeightCalculatedEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): LoadcellEventType {
    return EVENT_TYPE.LOADCELL.WEIGHT_CALCULATED;
  }

  public getPayload(): Properties<WeightCalculatedEvent> {
    return {
      portPath: this.portPath,
      hardwareId: this.hardwareId,
      weight: this.weight,
      status: this.status,
      timestamp: this.timestamp,
    };
  }
}
