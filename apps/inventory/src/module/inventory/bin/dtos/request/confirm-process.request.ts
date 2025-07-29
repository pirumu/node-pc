import { IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmProcessRequest {
  @ApiProperty()
  @IsBoolean()
  @Type(() => Boolean)
  isNextRequestItem: boolean;
}
