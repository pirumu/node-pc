import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';

export enum CabinetType {
  MAIN = 'main',
  SUB = 'sub',
}

export class GetCabinetsResponse {
  @ApiProperty()
  @Type(() => String)
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
  @Expose({ name: 'number_of_rows', toPlainOnly: true })
  @Type(() => Number)
  numberOfRows: number;

  @ApiProperty({
    name: 'total_bins',
  })
  @Expose({ name: 'total_bins', toPlainOnly: true })
  @IsNumber()
  @Type(() => Number)
  totalBins: number;

  @Expose({ name: 'type' })
  @IsEnum(Object.values(CabinetType))
  type: CabinetType;
}
