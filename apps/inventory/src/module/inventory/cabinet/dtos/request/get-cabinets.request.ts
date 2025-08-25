import { PaginationRequest } from '@common/dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class GetCabinetsRequest extends PaginationRequest {
  @ApiPropertyOptional({ example: 1 })
  @Type(() => String)
  @IsOptional()
  fields: string = '*';
}
