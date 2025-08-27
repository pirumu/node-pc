import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export enum CabinetType {
  MAIN = 'main',
  SUB = 'sub',
}

export class GetCabinetsResponse {
  @ApiProperty()
  @Expose()
  @Type(() => String)
  id: number;

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
  @Expose({ name: 'type' })
  @Type(() => String)
  type: CabinetType;

  @ApiProperty()
  @Expose({ name: 'type' })
  @Type(() => String)
  binType: string;
}
