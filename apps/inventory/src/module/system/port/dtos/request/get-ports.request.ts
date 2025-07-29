import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum } from 'class-validator';

import { PORT_STATUS } from '../../port.constants';

export class GetPortsRequest {
  @ApiProperty({
    enum: PORT_STATUS,
  })
  @Type(() => String)
  @IsEnum(PORT_STATUS)
  status: string;
}
