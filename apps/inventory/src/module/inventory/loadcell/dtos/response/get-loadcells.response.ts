import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Expose } from 'class-transformer';
import { IsString, IsNumber, IsBoolean, IsOptional, IsDateString, Min } from 'class-validator';

export class LoadcellState {
  @ApiProperty({ description: 'Weight update status', default: false })
  @Expose({ toClassOnly: true })
  @Type(() => Boolean)
  isUpdatedWeight: boolean = false;

  @ApiProperty({ description: 'Current status of loadcell', default: 'idle', example: 'idle' })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  status: string = 'idle';
}

export class CalibrationData {
  @ApiProperty({ description: 'Current quantity', default: 0, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  quantity: number = 0;

  @ApiProperty({ description: 'Maximum quantity capacity', default: 0, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  maxQuantity: number = 0;

  @ApiProperty({ description: 'Zero weight calibration value', default: 0 })
  @IsNumber()
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  zeroWeight: number = 0;

  @ApiProperty({ description: 'Unit weight for calculation', default: 0, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  unitWeight: number = 0;

  @ApiProperty({ description: 'Quantity marked as damaged', default: 0, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  damageQuantity: number = 0;
}

export class LiveReading {
  @ApiProperty({ description: 'Current weight reading from sensor', default: 0 })
  @IsNumber()
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  currentWeight: number = 0;

  @ApiProperty({ description: 'Calculated weight after processing', default: 0 })
  @IsNumber()
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  calculatedWeight: number = 0;

  @ApiProperty({ description: 'Calculated quantity based on unit weight', default: 0, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  calculatedQuantity: number = 0;
}

export class LoadcellItem {
  @ApiProperty({ description: 'Item ID', example: '507f1f77bcf86cd799439011' })
  @IsString()
  @Expose({ toClassOnly: true })
  @Type(() => String)
  itemId: string;

  @ApiProperty({ description: 'Item quantity', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  qty: number;

  @ApiProperty({ description: 'Critical threshold quantity', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  critical: number;

  @ApiProperty({ description: 'Minimum quantity threshold', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  min: number;

  @ApiProperty({ description: 'Maximum quantity threshold', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  max: number;

  @ApiPropertyOptional({ description: 'Item description', default: '' })
  @IsOptional()
  @IsString()
  @Expose({ toClassOnly: true })
  @Type(() => String)
  description: string = '';

  @ApiPropertyOptional({ description: 'Item barcode', default: '' })
  @IsOptional()
  @IsString()
  @Expose({ toClassOnly: true })
  @Type(() => String)
  barcode: string = '';

  @ApiPropertyOptional({ description: 'RFID tag', default: '' })
  @IsOptional()
  @IsString()
  @Expose({ toClassOnly: true })
  @Type(() => String)
  rfid: string = '';

  @ApiPropertyOptional({ description: 'Serial number', default: '' })
  @IsOptional()
  @IsString()
  @Expose({ toClassOnly: true })
  @Type(() => String)
  serialNumber: string = '';

  @ApiPropertyOptional({ description: 'Batch number', default: '' })
  @IsOptional()
  @IsString()
  @Expose({ toClassOnly: true })
  @Type(() => String)
  batchNumber: string = '';

  @ApiPropertyOptional({ description: 'Charge time', type: Date })
  @IsOptional()
  @IsDateString()
  @Expose({ toClassOnly: true })
  @Type(() => Date)
  chargeTime?: Date;

  @ApiPropertyOptional({ description: 'Inspection date', type: Date })
  @IsOptional()
  @IsDateString()
  @Expose({ toClassOnly: true })
  @Type(() => Date)
  inspection?: Date;

  @ApiPropertyOptional({ description: 'Hydrostatic test date', type: Date })
  @IsOptional()
  @IsDateString()
  @Expose({ toClassOnly: true })
  @Type(() => Date)
  hydrostaticTest?: Date;

  @ApiPropertyOptional({ description: 'Expiry date', type: Date })
  @IsOptional()
  @IsDateString()
  @Expose({ toClassOnly: true })
  @Type(() => Date)
  expiryDate?: Date;
}

export class GetLoadcellsResponse {
  @ApiProperty({ description: 'Loadcell ID', example: '507f1f77bcf86cd799439011' })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  id: string;

  @ApiProperty({ description: 'Site ID', example: '507f1f77bcf86cd799439011' })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  siteId: string;

  @ApiProperty({ description: 'Cluster ID', example: '507f1f77bcf86cd799439011' })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  clusterId: string;

  @ApiProperty({ description: 'Cabinet ID', example: '507f1f77bcf86cd799439011' })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  cabinetId: string;

  @ApiProperty({ description: 'Bin ID', example: '507f1f77bcf86cd799439011' })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  binId: string;

  @ApiProperty({ description: 'Loadcell code', example: 'LC001' })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  code: string;

  @ApiPropertyOptional({ description: 'Loadcell label', default: '' })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  label: string = '';

  @ApiPropertyOptional({ description: 'Item information', type: LoadcellItem })
  @Type(() => LoadcellItem)
  @Expose({ toClassOnly: true })
  item?: LoadcellItem;

  @ApiProperty({ description: 'Calibration data', type: CalibrationData })
  @Type(() => CalibrationData)
  @Expose({ toClassOnly: true })
  calibration: CalibrationData;

  @ApiProperty({ description: 'Live reading data', type: LiveReading })
  @Type(() => LiveReading)
  @Expose({ toClassOnly: true })
  reading: LiveReading;

  @ApiProperty({ description: 'Loadcell state', type: LoadcellState })
  @Type(() => LoadcellState)
  @Expose({ toClassOnly: true })
  state: LoadcellState;

  @ApiPropertyOptional({ description: 'Port ID', example: '507f1f77bcf86cd799439011' })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  portId?: string;

  @ApiProperty({ description: 'Hardware ID', default: 0, minimum: 0 })
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  hardwareId: number = 0;

  @ApiProperty({ description: 'Creation timestamp', type: Date })
  @Expose({ toClassOnly: true })
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', type: Date })
  @Expose({ toClassOnly: true })
  @Type(() => Date)
  updatedAt: Date;
}
