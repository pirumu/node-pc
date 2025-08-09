import { Expose, Type } from 'class-transformer';
import { IsMongoId } from 'class-validator';

export class NotifyBinOpenErrorPayload {
  @IsMongoId()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  transactionId: string;

  @IsMongoId()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  binId: string;
}
