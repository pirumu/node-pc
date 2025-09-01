import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsMongoId, IsNumber, IsOptional } from 'class-validator';

export class CalibrateLoadcellRequest {
  @ApiProperty({
    description: 'The id of the item being calibrated.',
    example: '60d5ecb4b37a4a001f8e8c1c',
  })
  @IsMongoId()
  itemId: string;

  @ApiProperty({
    description: 'The weight of the empty container (tare weight), captured by the user.',
    example: 5.2,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  zeroWeight: number;

  @ApiProperty({
    description: 'The total weight measured when a known quantity of items is on the loadcell.',
    example: 805.2,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  measuredWeight: number;

  @ApiProperty({
    description: 'The exact quantity of items that corresponds to the measuredWeight.',
    example: 10,
  })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => Number(value))
  measuredQuantity?: number;
}
