import { PaginationRequest } from '@common/dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsMongoId } from 'class-validator';

export * from './calibrate-loadcell.request';

export class GetLoadCellsRequest extends PaginationRequest {
  @ApiPropertyOptional({
    description: 'Port id to filter loadcells',
  })
  @IsMongoId({ message: 'Id must be a valid mongodb object id' })
  @IsOptional()
  portId?: string;
}
