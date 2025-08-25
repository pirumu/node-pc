import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class GetFacialRecognitionResponse {
  @ApiProperty()
  @Type(() => String)
  @Expose()
  userId: string;

  @ApiProperty()
  @Type(() => String)
  @Expose()
  data: string;

  @ApiProperty()
  @Type(() => String)
  @Expose()
  hik: string;
}
