import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class LoadcellRequest {
  @Type(() => Array<number>)
  hardwareIds: number[];

  @Type(() => Boolean)
  @IsOptional()
  forceReset?: boolean = false;
}
