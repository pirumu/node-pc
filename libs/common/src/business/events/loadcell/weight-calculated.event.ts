import { EVENT_TYPE, LoadcellEventType } from '@common/constants';
import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';
import { Expose, Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class WeightCalculatedEvent implements IAppEvent {
  @Type(() => String)
  @Expose()
  @IsOptional()
  portPath: string;

  @Type(() => Number)
  @Expose()
  @IsOptional()
  hardwareId: number;

  @Type(() => String)
  @Expose()
  @IsOptional()
  weight: number;

  @Type(() => String)
  @Expose()
  @IsOptional()
  status: string;

  @Type(() => String)
  @Expose()
  @IsOptional()
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
