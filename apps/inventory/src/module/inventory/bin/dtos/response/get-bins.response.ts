import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsDateString, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { BIN_TYPES, BinType } from '@dals/mongo/entities';

export class BinItemResponse {
  @ApiProperty({
    description: 'Item ID',
    example: '507f1f77bcf86cd799439011',
  })
  @Expose()
  @Type(() => String)
  itemId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 10,
  })
  @Expose()
  @Type(() => Number)
  qty: number;

  @ApiProperty({
    description: 'Critical threshold level',
    example: 2,
  })
  @Expose()
  @Type(() => Number)
  critical: number;

  @ApiProperty({
    description: 'Minimum quantity',
    example: 1,
  })
  @Expose()
  @Type(() => Number)
  min: number;

  @ApiProperty({
    description: 'Maximum quantity',
    example: 50,
  })
  @Expose()
  @Type(() => Number)
  max: number;

  @ApiPropertyOptional({
    description: 'Item description',
    example: 'Industrial tool',
  })
  @Expose()
  @Type(() => String)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Barcode',
    example: '1234567890123',
  })
  @Expose()
  @Type(() => String)
  @IsOptional()
  barcode?: string;

  @ApiPropertyOptional({
    description: 'RFID code',
    example: 'RFID123456',
  })
  @Expose()
  @Type(() => String)
  @IsOptional()
  rfid?: string;

  @ApiPropertyOptional({
    description: 'Serial number',
    example: 'SN001234',
  })
  @Expose()
  @Type(() => String)
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({
    description: 'Batch number',
    example: 'BATCH001',
  })
  @Expose()
  @Type(() => String)
  @IsOptional()
  batchNumber?: string;

  @ApiPropertyOptional({
    description: 'Charge time',
    example: '2024-01-15T10:30:00Z',
  })
  @Expose()
  @IsDateString()
  @IsOptional()
  chargeTime?: string;

  @ApiPropertyOptional({
    description: 'Inspection time',
    example: '2024-01-20T14:00:00Z',
  })
  @Expose()
  @IsDateString()
  @IsOptional()
  inspection?: string;

  @ApiPropertyOptional({
    description: 'Hydrostatic test time',
    example: '2024-01-25T09:00:00Z',
  })
  @Expose()
  @IsDateString()
  @IsOptional()
  hydrostaticTest?: string;

  @ApiPropertyOptional({
    description: 'Expiry date',
    example: '2025-01-15T00:00:00Z',
  })
  @Expose()
  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}

export class BinStateResponse {
  @ApiProperty({
    description: 'Is processing',
    example: false,
  })
  @Expose()
  @IsBoolean()
  isProcessing: boolean;

  @ApiProperty({
    description: 'Has failed',
    example: false,
  })
  @Expose()
  @IsBoolean()
  isFailed: boolean;

  @ApiProperty({
    description: 'Is locked',
    example: true,
  })
  @Expose()
  @IsBoolean()
  isLocked: boolean;

  @ApiProperty({
    description: 'Is damaged',
    example: false,
  })
  @Expose()
  @IsBoolean()
  isDamage: boolean;
}

export class SiteResponse {
  @ApiProperty({
    description: 'Site ID',
    example: '507f1f77bcf86cd799439011',
  })
  @Expose()
  @Type(() => String)
  id: string;

  @ApiProperty({
    description: 'Site name',
    example: 'Site A',
  })
  @Expose()
  @Type(() => String)
  name: string;
}

export class ClusterResponse {
  @ApiProperty({
    description: 'Cluster ID',
    example: '507f1f77bcf86cd799439011',
  })
  @Expose()
  @Type(() => String)
  id: string;

  @ApiProperty({
    description: 'Cluster name',
    example: 'Cluster 1',
  })
  @Expose()
  @Type(() => String)
  name: string;
}

export class CabinetResponse {
  @ApiProperty({
    description: 'Cabinet ID',
    example: '507f1f77bcf86cd799439011',
  })
  @Expose()
  @Type(() => String)
  id: string;

  @ApiProperty({
    description: 'Cabinet name',
    example: 'Cabinet A1',
  })
  @Expose()
  @Type(() => String)
  name: string;
}

export class LoadcellResponse {
  @ApiProperty({
    description: 'Loadcell ID',
    example: '507f1f77bcf86cd799439011',
  })
  @Expose()
  @Type(() => String)
  id: string;

  @ApiProperty({
    description: 'Loadcell code',
    example: '01',
  })
  @Expose()
  @Type(() => String)
  code: string;

  @ApiProperty({
    description: 'Loadcell label',
    example: 'Loadcell 001',
  })
  @Expose()
  @Type(() => String)
  label: string;

  @ApiProperty({
    description: 'Loadcell hardwareId',
    example: 'Loadcell 001',
  })
  @Expose()
  @Type(() => Number)
  hardwareId: number;

  @ApiProperty({
    description: 'Loadcell item',
  })
  @Expose()
  item: any;
}

export class GetBinResponse {
  @ApiProperty({
    description: 'Bin ID',
    example: '507f1f77bcf86cd799439011',
  })
  @Expose()
  @Type(() => String)
  id: string;

  @ApiProperty({
    description: 'Site information',
    type: SiteResponse,
  })
  @Expose()
  @Type(() => SiteResponse)
  @ValidateNested()
  site: SiteResponse;

  @ApiProperty({
    description: 'Cluster information',
    type: ClusterResponse,
  })
  @Expose()
  @Type(() => ClusterResponse)
  @ValidateNested()
  cluster: ClusterResponse;

  @ApiProperty({
    description: 'Cabinet information',
    type: CabinetResponse,
  })
  @Expose()
  @Type(() => CabinetResponse)
  @ValidateNested()
  cabinet: CabinetResponse;

  @ApiPropertyOptional({
    description: 'Loadcells list',
    type: [LoadcellResponse],
  })
  @Expose()
  @Type(() => LoadcellResponse)
  @ValidateNested({ each: true })
  @IsArray()
  @IsOptional()
  loadcells?: LoadcellResponse[];

  @ApiProperty({
    description: 'CU Lock ID',
    example: 0,
  })
  @Expose()
  @Type(() => Number)
  cuLockId: number;

  @ApiProperty({
    description: 'Lock ID',
    example: 1,
  })
  @Expose()
  @Type(() => Number)
  lockId: number;

  @ApiProperty({
    description: 'X coordinate',
    example: 100,
  })
  @Expose()
  @Type(() => Number)
  x: number;

  @ApiProperty({
    description: 'Y coordinate',
    example: 200,
  })
  @Expose()
  @Type(() => Number)
  y: number;

  @ApiProperty({
    description: 'Width',
    example: 50,
  })
  @Expose()
  @Type(() => Number)
  width: number;

  @ApiProperty({
    description: 'Height',
    example: 80,
  })
  @Expose()
  @Type(() => Number)
  height: number;

  @ApiProperty({
    description: 'Minimum quantity',
    example: 5,
  })
  @Expose()
  @Type(() => Number)
  minQty: number;

  @ApiProperty({
    description: 'Maximum quantity',
    example: 100,
  })
  @Expose()
  @Type(() => Number)
  maxQty: number;

  @ApiProperty({
    description: 'Critical quantity threshold',
    example: 10,
  })
  @Expose()
  @Type(() => Number)
  criticalQty: number;

  @ApiProperty({
    description: 'Bin type',
    enum: BIN_TYPES,
    example: BIN_TYPES.NORMAL,
  })
  @Expose()
  @IsEnum(BIN_TYPES)
  type: BinType;

  @ApiProperty({
    description: 'Items in bin',
    type: [BinItemResponse],
  })
  @Expose()
  @Type(() => BinItemResponse)
  @ValidateNested({ each: true })
  @IsArray()
  items: BinItemResponse[];

  @ApiProperty({
    description: 'Bin state',
    type: BinStateResponse,
  })
  @Expose()
  @Type(() => BinStateResponse)
  @ValidateNested()
  state: BinStateResponse;

  @ApiProperty({
    description: 'Created at',
    example: '2024-01-15T10:30:00Z',
  })
  @Expose()
  @IsDateString()
  createdAt: string;

  @ApiProperty({
    description: 'Updated at',
    example: '2024-01-20T15:45:00Z',
  })
  @Expose()
  @IsDateString()
  updatedAt: string;
}
