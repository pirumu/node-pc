import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetConditionsResponse {
  @ApiProperty()
  @Type(() => String)
  id: string;

  @ApiProperty()
  @Type(() => String)
  name: string;

  @ApiProperty()
  @Type(() => String)
  description: string;

  @ApiProperty({
    required: false,
  })
  @Type(() => String)
  createdAt: string;

  @ApiProperty({
    required: false,
  })
  @Type(() => String)
  updatedAt: string;
}
