import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export enum CabinetType {
  MAIN = 'MAIN',
  SUB = 'SUB',
}

export class GetCabinetsResponse {
  @ApiProperty()
  @Expose()
  @Type(() => String)
  id: string;

  @ApiProperty()
  @Expose()
  @Type(() => String)
  siteId: string;

  @ApiProperty()
  @Expose()
  @Type(() => String)
  name: string;

  @ApiProperty()
  @Expose()
  @Type(() => Number)
  rowNumber: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  @Type(() => Number)
  binNumber: number;

  @ApiProperty()
  @Expose()
  @Type(() => String)
  type: CabinetType;

  @ApiProperty()
  @Expose()
  @Type(() => String)
  binType: string;
}
