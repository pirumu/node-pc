import { Expose, Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ChangeProcessStatusPayload {
  @Expose({ toClassOnly: true })
  transactionId: string;

  @IsBoolean()
  @Type(() => Boolean)
  @Expose({ toClassOnly: true })
  isProcessingItem: boolean;

  @IsBoolean()
  @Type(() => Boolean)
  @Expose({ toClassOnly: true })
  isNextRequestItem: boolean;
}
