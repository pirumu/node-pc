import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Expose } from 'class-transformer';
import { IsString, IsNumber, IsBoolean, IsOptional, IsDateString, Min } from 'class-validator';
import { Default } from '@framework/decorators';

export class LoadcellState {
  @ApiProperty({
    description: 'Weight update status',
    default: false,
    example: false,
  })
  @Expose({ toClassOnly: true })
  @Type(() => Boolean)
  isUpdatedWeight: boolean = false;

  @ApiProperty({
    description: 'Current status of loadcell',
  })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  status: string;

  @ApiProperty({
    description: 'Whether the loadcell is calibrated',
    default: false,
    example: true,
  })
  @Expose({ toClassOnly: true })
  @Type(() => Boolean)
  isCalibrated: boolean = false;

  @ApiProperty({
    description: 'Whether the loadcell is currently running/active',
    default: false,
    example: true,
  })
  @Expose({ toClassOnly: true })
  @Type(() => Boolean)
  isRunning: boolean = false;
}

export class CalibrationData {
  @ApiProperty({
    description: 'Available quantity in the bin',
    default: 0,
    minimum: 0,
    example: 150,
  })
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  availableQuantity: number = 0;

  @ApiProperty({
    description: 'Calibrated/reference quantity used for calibration',
    default: 0,
    minimum: 0,
    example: 100,
  })
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  calibratedQuantity: number = 0;

  @ApiProperty({
    description: 'Zero weight calibration value (tare weight)',
    default: 0,
    example: 1500.5,
  })
  @IsNumber()
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  zeroWeight: number = 0;

  @ApiProperty({
    description: 'Unit weight for quantity calculation (weight per item)',
    default: 0,
    minimum: 0,
    example: 12.5,
  })
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  unitWeight: number = 0;

  @ApiProperty({
    description: 'Quantity marked as damaged/defective',
    default: 0,
    minimum: 0,
    example: 5,
  })
  @IsNumber()
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  damageQuantity: number = 0;

  @ApiPropertyOptional({
    description: 'Next calibration due date',
    type: String,
    format: 'date-time',
    example: '2024-12-31T23:59:59.000Z',
    nullable: true,
  })
  @Expose({ toClassOnly: true })
  @Type(() => Date)
  calibrationDue?: Date | null = null;
}

export class LiveReading {
  @ApiProperty({
    description: 'Current raw weight reading from sensor',
    default: 0,
    example: 1875.25,
  })
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  currentWeight: number = 0;

  @ApiProperty({
    description: 'Pending weight change from last reading',
    default: 0,
    example: 25.5,
  })
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  pendingChange: number = 0;
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
  @Default(new LoadcellItem())
  itemInfo?: LoadcellItem;

  @ApiProperty({ description: 'Calibration data', type: CalibrationData })
  @Type(() => CalibrationData)
  @Expose({ toClassOnly: true })
  @Default(new CalibrationData())
  calibration: CalibrationData;

  @ApiProperty({ description: 'Live reading data', type: LiveReading })
  @Type(() => LiveReading)
  @Expose({ toClassOnly: true })
  @Default(new LiveReading())
  reading: LiveReading;

  @ApiProperty({ description: 'Loadcell state', type: LoadcellState })
  @Type(() => LoadcellState)
  @Expose({ toClassOnly: true })
  @Default(new LoadcellState())
  state: LoadcellState;

  @ApiPropertyOptional({ description: 'Port ID', example: '507f1f77bcf86cd799439011' })
  @Expose({ toClassOnly: true })
  @Type(() => String)
  portId?: string;

  @ApiProperty({ description: 'Hardware ID', default: 0, minimum: 0 })
  @Expose({ toClassOnly: true })
  @Type(() => Number)
  @Default(0)
  hardwareId: number = 0;

  @ApiProperty({ description: 'Creation timestamp', type: Date })
  @Expose({ toClassOnly: true })
  @Type(() => Date)
  @Default(null)
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', type: Date })
  @Expose({ toClassOnly: true })
  @Type(() => Date)
  @Default(null)
  updatedAt: Date;
}
