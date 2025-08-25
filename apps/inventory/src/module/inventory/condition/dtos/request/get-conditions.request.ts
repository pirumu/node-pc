import { CONDITION_TYPE } from '@common/constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsArray } from 'class-validator';

export class GetConditionsRequest {
  @ApiProperty({
    required: false,
    type: [String],
    example: Object.values(CONDITION_TYPE),
    default: [CONDITION_TYPE.WORKING],
  })
  @Type(() => Array<string>)
  @IsArray()
  @Expose({ toClassOnly: true })
  excludeName: CONDITION_TYPE[] = [CONDITION_TYPE.WORKING];
}
