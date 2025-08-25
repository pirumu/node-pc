import { PaginationRequest } from '@common/dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId, IsOptional } from 'class-validator';

export class GetItemRequest extends PaginationRequest {
  @ApiProperty({
    required: false,
  })
  @Type(() => String)
  @IsOptional()
  keyword?: string;

  @ApiProperty({
    required: false,
  })
  @Type(() => String)
  @IsMongoId()
  @IsOptional()
  itemTypeId?: string;
}
