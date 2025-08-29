import { PaginationRequest } from '@common/dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId, IsOptional } from 'class-validator';

export class GetBinsRequest extends PaginationRequest {
  @ApiProperty({
    required: false,
  })
  @IsMongoId()
  @Type(() => String)
  @IsOptional()
  siteId?: string;

  @ApiProperty({
    required: false,
  })
  @IsMongoId()
  @Type(() => String)
  @IsOptional()
  cabinetId?: string;

  @ApiProperty({
    required: false,
  })
  @IsMongoId()
  @Type(() => String)
  @IsOptional()
  binId?: string;

  @ApiProperty({ required: false })
  @Type(() => Boolean)
  @IsOptional()
  enrich?: boolean;
}

export class GetBinRequest {
  @ApiProperty({ required: false })
  @Type(() => Boolean)
  @IsOptional()
  enrich?: boolean;
}
