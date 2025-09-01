import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString } from 'class-validator';

export class UpdateWorkingOrderRequest {
  @ApiProperty({
    description: 'Work Order number',
    example: '001567856',
    required: false,
  })
  @IsString()
  @Type(() => String)
  wo: string;

  @ApiProperty({
    description: 'Vehicle number',
    example: '11345',
    required: false,
  })
  @Type(() => String)
  @IsString()
  vehicleNum: string;

  @ApiProperty({
    description: 'Vehicle type',
    example: 'A',
    required: false,
  })
  @Type(() => String)
  @IsString()
  vehicleType: string;

  @ApiProperty({
    description: 'Platform identifier',
    example: '1',
    required: false,
  })
  @Type(() => String)
  @IsString()
  platform: string;
}
