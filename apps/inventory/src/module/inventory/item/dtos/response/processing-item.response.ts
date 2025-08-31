import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ProcessingItemResponse {
  @ApiProperty()
  @Type(() => String)
  @Expose()
  transactionId: string;
}
