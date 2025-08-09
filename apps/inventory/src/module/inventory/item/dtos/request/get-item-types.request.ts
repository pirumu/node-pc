import { PROCESS_ITEM_TYPE } from '@common/constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEnum } from 'class-validator';

export class GetItemTypesRequest {
  @ApiProperty({
    enum: PROCESS_ITEM_TYPE,
  })
  @IsEnum(PROCESS_ITEM_TYPE)
  @Expose({ toClassOnly: true })
  type: PROCESS_ITEM_TYPE;
}
