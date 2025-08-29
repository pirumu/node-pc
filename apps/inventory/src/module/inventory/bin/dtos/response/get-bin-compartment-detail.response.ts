import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

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
}
