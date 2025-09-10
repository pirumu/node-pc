import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CalibrationDto {
  @ApiProperty({})
  @Expose()
  zeroWeight: number;

  @ApiProperty({})
  @Expose()
  calculatedWeight: number;

  @ApiProperty({})
  @Expose()
  unitWeight: number;

  @ApiProperty({})
  @Expose()
  calibratedQuantity: number;

  @ApiProperty({})
  @Expose()
  calibrationDue: Date | null = null;
}

export class LoadcellDto {
  @ApiProperty({})
  @Expose()
  id: string;

  @ApiProperty({})
  @Expose()
  hardwareId: number;

  @ApiProperty({})
  @Expose()
  code: string;

  @ApiProperty({})
  @Expose()
  label: string;
}

export class ItemDto {
  @ApiProperty({
    description: 'Item ID',
    example: '689da8b42b72ebe67004e51f',
  })
  @Expose()
  itemId: string;

  @ApiProperty({
    description: 'Item name',
    example: 'Iphone 11',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Part number',
    example: 'A11',
  })
  @Expose()
  partNo: string;

  @ApiProperty({
    description: 'Item type',
    example: 'Consumable',
  })
  @Expose()
  itemType: string;

  @ApiProperty({
    description: 'Quantity',
    example: 25,
  })
  @Expose()
  quantity: number;

  @ApiProperty({
    description: 'Batch number',
    example: '1232',
  })
  @Expose()
  batchNumber: string;

  @ApiProperty({
    description: 'Serial number',
    example: '1223',
  })
  @Expose()
  serialNumber: string;

  @ApiProperty({
    description: 'Expiry date',
    example: '2025-09-01T17:00:00.000Z',
    type: Date,
  })
  @Expose()
  expiryDate: Date;

  @ApiProperty({
    description: 'Shelf status',
    example: 'good',
  })
  @Expose()
  status: string;

  @ApiProperty({})
  @Expose()
  type: string;

  @ApiProperty({})
  @Expose()
  materialNo: string;

  @ApiProperty({})
  @Expose()
  critical: number = 0;

  @ApiProperty({})
  @Expose()
  min: number = 0;

  @ApiProperty({})
  @Expose()
  max: number = 0;

  @ApiProperty({})
  @Expose()
  isCalibrated: boolean;

  @ApiProperty({})
  @Type(() => CalibrationDto)
  @Expose()
  calibration: CalibrationDto;

  @ApiProperty({})
  @Type(() => LoadcellDto)
  @Expose()
  loadcell?: LoadcellDto;

  @ApiProperty({})
  @Expose()
  liveReading: any;
}

export class GetBinCompartmentDetail {
  @ApiProperty({
    example: '689da5442b72ebe67004e4d5',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'X position',
    example: 3,
  })
  @Expose()
  x: number;

  @ApiProperty({
    description: 'Y position',
    example: 1,
  })
  @Expose()
  y: number;

  @ApiProperty({
    description: 'Width',
    example: 1,
  })
  @Expose()
  width: number;

  @ApiProperty({
    description: 'Height',
    example: 1,
  })
  @Expose()
  height: number;

  @ApiProperty({
    description: 'Shelf type',
    example: 'LOADCELL',
    enum: ['LOADCELL'], // Có thể thêm các type khác
  })
  @Expose()
  type: string;

  @ApiProperty({
    description: 'Shelf status',
    example: 'good',
  })
  @Expose()
  status: string;

  @ApiProperty({
    description: 'Total quantity on hand',
    example: 50,
  })
  @Expose()
  totalQtyOH: number;

  @ApiProperty({
    description: 'Items in shelf',
    type: [ItemDto],
  })
  @Expose()
  @Type(() => ItemDto)
  items: ItemDto[];

  @ApiProperty({})
  @Expose()
  index: number;
}
