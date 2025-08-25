import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class GetConditionsResponse {
  @ApiProperty()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  id: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  name: string;

  @ApiProperty()
  @Type(() => Boolean)
  @Expose({ toClassOnly: true })
  isSystemType: boolean;

  @ApiProperty({
    required: false,
  })
  @Type(() => String)
  @Expose({ toClassOnly: true })
  createdAt: string;

  @ApiProperty({
    required: false,
  })
  @Type(() => String)
  @Expose({ toClassOnly: true })
  updatedAt: string;
}
