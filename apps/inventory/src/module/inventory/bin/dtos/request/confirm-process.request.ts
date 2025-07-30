import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ConfirmProcessRequest {
  @ApiProperty()
  @IsBoolean()
  @Type(() => Boolean)
  isNextRequestItem: boolean;
}
