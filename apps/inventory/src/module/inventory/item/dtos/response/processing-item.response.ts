import { ApiProperty } from '@nestjs/swagger';

export class ProcessingItemResponse {
  @ApiProperty()
  transactionId: string;
}
