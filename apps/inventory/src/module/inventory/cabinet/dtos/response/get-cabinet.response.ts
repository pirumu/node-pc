import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, IsArray, ValidateNested, Min } from 'class-validator';

const booleanToNumber = ({ value }: { value: any }) => {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value;
};

export enum BinStatus {
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
}

export class BinDto {
  @ApiProperty({ description: 'Bin ID' })
  @IsNumber()
  @Type(() => Number)
  id: number;

  @ApiProperty({ description: 'Lock ID' })
  @Expose({ name: 'lock_id' })
  @IsNumber()
  @Type(() => Number)
  lockId: number;

  @ApiProperty({ description: 'CU ID' })
  @Expose({ name: 'cu_id' })
  @IsNumber()
  @Type(() => Number)
  cuId: number;

  @ApiProperty({ description: 'Total load cells' })
  @Expose({ name: 'total_loadcells' })
  @Type(() => Number)
  totalLoadcells: number;

  @ApiProperty({ description: 'Row number' })
  @Type(() => Number)
  @Min(1)
  row: number;

  @ApiProperty({ description: 'Minimum value' })
  @Type(() => Number)
  min: number;

  @ApiProperty({ description: 'Maximum value' })
  @Type(() => Number)
  max: number;

  @ApiProperty({ description: 'Critical value' })
  @Type(() => Number)
  critical: number;

  @ApiProperty({ description: 'Quantity' })
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ description: 'Quantity on hold' })
  @Expose({ name: 'quantity_oh' })
  @Type(() => Number)
  quantityOh: number;

  @ApiProperty({ description: 'Quantity damage' })
  @Expose({ name: 'quantity_damage' })
  @Type(() => Number)
  quantityDamage: number;

  @ApiProperty({ description: 'Bin name' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Processing status: 0 - không có người xử lý, 1 - đang có người xử lý',
    enum: [0, 1],
  })
  @Expose({ name: 'is_processing' })
  @Transform(booleanToNumber)
  @IsNumber()
  isProcessing: 0 | 1;

  @ApiProperty({
    description: 'Lock status: 0 - unlocked, 1 - locked',
    enum: [0, 1],
  })
  @Expose({ name: 'is_locked' })
  @Transform(booleanToNumber)
  @IsNumber()
  isLocked: 0 | 1;

  @ApiProperty({
    description: 'Failed status: 0 - no failure, 1 - failed',
    enum: [0, 1],
  })
  @Expose({ name: 'is_failed' })
  @Transform(booleanToNumber)
  @IsNumber()
  isFailed: 0 | 1;

  @ApiProperty({
    description: 'Damage status: 0 - no damage, 1 - damaged',
    enum: [0, 1],
  })
  @Expose({ name: 'is_damage' })
  @Transform(booleanToNumber)
  @IsNumber()
  isDamage: 0 | 1;

  @ApiProperty({
    description: 'Bin assignment status',
    enum: Object.values(BinStatus),
  })
  @IsEnum(Object.values(BinStatus))
  status: BinStatus;

  @ApiProperty({
    description: 'RFID status: 0 - no RFID, 1 - has RFID',
    enum: [0, 1],
  })
  @Expose({ name: 'is_rfid' })
  @Transform(booleanToNumber)
  @IsNumber()
  isRfid: 0 | 1;
}

export class CabinetDto {
  @ApiProperty({ description: 'Cabinet ID' })
  @IsNumber()
  @Type(() => Number)
  @Transform(({ value, obj }) => {
    return typeof value === 'string' ? parseInt(value.slice(-8), 16) : value;
  })
  id: number;

  @ApiProperty({ description: 'Cabinet name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Cabinet code' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Number of rows' })
  @Expose({ name: 'number_of_rows' })
  @IsNumber()
  @Type(() => Number)
  numberOfRows: number;

  @ApiProperty({ description: 'Total bins' })
  @Expose({ name: 'total_bins' })
  @IsNumber()
  @Type(() => Number)
  totalBins: number;

  @ApiProperty({ description: 'Cabinet status' })
  @IsString()
  status: string;
}

export class GetCabinetResponse extends CabinetDto {
  @ApiProperty({
    description: 'List of bins in cabinet',
    type: [BinDto],
  })
  @ValidateNested({ each: true })
  @Type(() => BinDto)
  bins: BinDto[];
}
