import { CONDITION_TYPE } from '@common/constants';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
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
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    return [value];
  })
  @Expose({ toClassOnly: true })
  excludeName: CONDITION_TYPE[] = [CONDITION_TYPE.WORKING];
}
