import { PaginationRequest } from '@common/dto';
import { PORT_STATUS, PortStatus } from '@dals/mongo/entities';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

export class GetPortsRequest extends PaginationRequest {
  @ApiProperty({
    enum: PORT_STATUS,
    required: false,
  })
  @Type(() => String)
  @IsEnum(PORT_STATUS)
  @IsOptional()
  status?: PortStatus;
}
