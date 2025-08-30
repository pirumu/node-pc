import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';

export class UpdatePortNameRequest {
  @ApiProperty()
  @Type(() => String)
  @Expose()
  @IsNotEmpty()
  name: string;
}
