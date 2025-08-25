import { PaginationRequest } from '@common/dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class GetClustersRequest extends PaginationRequest {
  @ApiProperty()
  @Type(() => Boolean)
  @IsOptional()
  enrich?: boolean;
}
