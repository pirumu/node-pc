import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsMongoId } from 'class-validator';

export class NotifyProcessErrorPayload {
  @IsMongoId()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  transactionId: string;

  @IsBoolean()
  @Type(() => Boolean)
  @Expose({ toClassOnly: true })
  isCloseWarningPopup: boolean;

  @IsBoolean()
  @Type(() => Boolean)
  @Expose({ toClassOnly: true })
  isNextRequestItem: boolean;
}
