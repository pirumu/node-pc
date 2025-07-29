import { Expose, Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CabinetType {
  MAIN = 'main',
  SUB = 'sub',
}

export class GetCabinetsResponse {
  @ApiProperty()
  @Type(() => Number)
  @Transform(({ value, obj }) => {
    if (typeof value === 'string') {
      return parseInt(value.slice(-8), 16); // backward compatible. because client validate response data.
    }
    return value;
  })
  id: number;

  @ApiProperty()
  @Type(() => String)
  name: string;

  @ApiProperty()
  @IsOptional()
  @Type(() => String)
  code: string | null;

  @ApiProperty({
    name: 'number_of_rows',
  })
  @Expose({ name: 'number_of_rows' })
  @Type(() => Number)
  numberOfRows: number;

  @ApiProperty({
    name: 'total_bins',
  })
  @Expose({ name: 'total_bins' })
  @IsNumber()
  @Type(() => Number)
  totalBins: number;

  @Expose({ name: 'type' })
  @IsEnum(Object.values(CabinetType))
  type: CabinetType;
}
