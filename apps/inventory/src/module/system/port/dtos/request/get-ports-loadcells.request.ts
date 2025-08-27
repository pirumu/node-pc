import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

import { GetPortsRequest } from './get-ports.request';

export class GetPortsLoadcellsRequest extends GetPortsRequest {
  @ApiProperty({ required: false })
  @IsMongoId()
  @IsOptional()
  portId?: string;
}
