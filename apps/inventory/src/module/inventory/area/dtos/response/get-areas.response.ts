import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class GetAreasResponse {
  @ApiProperty()
  @Type(() => String)
  id: string;

  @ApiProperty()
  @Type(() => String)
  name: string;

  @ApiProperty()
  @Type(() => Number)
  torque: number;

  @ApiProperty()
  @Expose({
    name: 'created_at',
  })
  @Type(() => String)
  createdAt: string;

  @ApiProperty({
    required: false,
  })
  @Expose({
    name: 'updated_at',
  })
  @Type(() => String)
  updatedAt?: string;
}
