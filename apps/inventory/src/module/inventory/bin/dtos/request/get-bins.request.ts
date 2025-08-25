import { PaginationRequest } from '@common/dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId, IsOptional } from 'class-validator';

export class GetBinsRequest extends PaginationRequest {
  @ApiProperty()
  @IsMongoId()
  @Type(() => String)
  @IsOptional()
  cabinetId?: string;

  @ApiProperty()
  @Type(() => Boolean)
  @IsOptional()
  enrich?: boolean;
}

export class GetBinRequest {
  @ApiProperty()
  @Type(() => Boolean)
  @IsOptional()
  enrich?: boolean;
}
