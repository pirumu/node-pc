import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Default } from '@framework/decorators';

export class BinItemDto {
  @ApiProperty({ example: 'item_001', description: 'Item ID' })
  id: string;

  @ApiProperty({ example: 'Surgical Scissors', description: 'Item name' })
  name: string;

  @ApiProperty({ example: 'SS-001', description: 'Part number' })
  partNo: string;

  @ApiProperty({ example: 'MAT-12345', description: 'Material number' })
  materialNo: string;

  @ApiProperty({ example: 'SN-789012', description: 'Serial number' })
  serialNo: string;

  @ApiProperty({
    example: '2024-12-31T23:59:59Z',
    description: 'Due date',
    nullable: true,
  })
  due: string | null;

  @ApiProperty({ example: 15, description: 'Quantity on hand' })
  qtyOH: number;

  @ApiProperty({
    enum: ['good', 'on-loan', 'low-critical'],
    example: 'good',
    description: 'Item status',
  })
  status: 'good' | 'average' | 'low-critical' | 'unavailable';

  @ApiProperty({ example: true, description: 'Can be calibrated' })
  canCalibrate: boolean;

  @ApiProperty({
    example: 'LC-001',
    description: 'Load cell ID',
    required: false,
  })
  loadcellId?: string;
}

export class BinDetailDto {
  @ApiProperty({ example: 'detail_001', description: 'Detail ID' })
  id: string;

  @ApiProperty({
    enum: ['RFID', 'BITS', 'Loadcell'],
    example: 'RFID',
    description: 'Detection type',
  })
  type: 'RFID' | 'BITS' | 'Loadcell';

  @ApiProperty({
    type: [BinItemDto],
    description: 'List of items in this detail',
  })
  items: BinItemDto[];
}

export class GetBinCompartmentsResponse {
  @ApiProperty({ example: 'bin_001', description: 'Bin ID' })
  @Expose()
  id: string;

  @ApiProperty({ example: 0, description: 'X position in grid' })
  @Expose()
  x: number;

  @ApiProperty({ example: 0, description: 'Y position in grid' })
  @Expose()
  y: number;

  @ApiProperty({ example: 1, description: 'Width in grid units' })
  @Expose()
  width: number;

  @ApiProperty({ example: 1, description: 'Height in grid units' })
  @Expose()
  height: number;

  @ApiProperty({ example: 'surgical', description: 'Bin type' })
  @Expose()
  type: string;

  @ApiProperty({ example: 3, description: 'Total number of items' })
  @Expose()
  totalItems: number;

  @ApiProperty({ example: 3, description: 'Total number of loadcells' })
  @Expose()
  totalItemLoadcells: number;

  @ApiProperty({ example: 45, description: 'Total quantity on hand' })
  @Expose()
  totalQtyOH: number = 0;

  @ApiProperty({
    enum: ['good', 'average', 'low-critical', 'unavailable'],
    example: 'good',
    description: 'Bin status',
  })
  @Expose()
  status: 'good' | 'average' | 'low-critical' | 'unavailable';

  @ApiProperty({})
  @Expose()
  index: number;
}
