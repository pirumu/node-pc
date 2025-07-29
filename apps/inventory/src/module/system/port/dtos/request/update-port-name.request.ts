import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId } from 'class-validator';

export class UpdatePortNameRequest {
  @ApiProperty()
  @Type(() => String)
  name: string;

  @ApiProperty()
  @Type(() => String)
  @IsMongoId()
  portId: string;
}
