import { PROCESS_ITEM_TYPE } from '@common/constants';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsMongoId } from 'class-validator';

import { ProcessDataResult } from '../../item.types';

export class ProcessItemPayload {
  @IsEnum(PROCESS_ITEM_TYPE)
  @Type(() => String)
  @Expose({ toClassOnly: true })
  transactionType: PROCESS_ITEM_TYPE;

  @IsMongoId()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  transactionId: string;

  @Expose({ toClassOnly: true })
  data: ProcessDataResult;
}
