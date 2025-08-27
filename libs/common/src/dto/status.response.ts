import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class StatusResponse {
  @ApiProperty()
  @Type(() => Boolean)
  @Expose()
  status: boolean;
}
