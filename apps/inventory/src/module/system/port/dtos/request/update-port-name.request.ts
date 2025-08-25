import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdatePortNameRequest {
  @ApiProperty()
  @Type(() => String)
  name: string;
}
