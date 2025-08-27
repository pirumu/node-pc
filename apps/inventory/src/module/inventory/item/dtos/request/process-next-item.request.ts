import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsMongoId } from 'class-validator';

export class ProcessNextItemRequest {
  @ApiProperty()
  @IsMongoId()
  transactionId: string;

  @ApiProperty()
  @IsBoolean()
  isNextRequestItem: boolean;
}
