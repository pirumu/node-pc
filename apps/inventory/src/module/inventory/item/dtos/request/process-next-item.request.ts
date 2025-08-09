import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ProcessNextItemRequest {
  @ApiProperty()
  @IsBoolean()
  isNextRequestItem: boolean;
}
