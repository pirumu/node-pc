import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ItemInfoDto {
  @ApiProperty({ description: 'Bin identifier where item is located' })
  @Expose()
  binId: string;

  @ApiProperty({ description: 'Batch number of the item' })
  @Expose()
  batchNumber: string;

  @ApiProperty({ description: 'Serial number of the item' })
  @Expose()
  serialNumber: string;

  @ApiProperty({ description: 'Due date of the item', required: false, type: Date })
  @Expose()
  @Type(() => Date)
  dueDate?: Date;
}

abstract class BaseItemRecordDto {
  @ApiProperty({ description: 'Unique identifier of the item' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Name of the item' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'Part number of the item' })
  @Expose()
  partNo: string;

  @ApiProperty({ description: 'Material number of the item' })
  @Expose()
  materialNo: string;

  @ApiProperty({ description: 'Item type identifier' })
  @Expose()
  itemTypeId: string;

  @ApiProperty({ description: 'Item type name' })
  @Expose()
  type: string;

  @ApiProperty({ description: 'Item image URL', required: false })
  @Expose()
  image?: string;

  @ApiProperty({ description: 'Item description', required: false })
  @Expose()
  description?: string;
}

export class IssuableItemResponse extends BaseItemRecordDto {
  @ApiProperty({ description: 'Total quantity available for issue' })
  @Expose()
  totalQuantity: number;

  @ApiProperty({ description: 'Total calculated quantity', required: false })
  @Expose()
  totalCalcQuantity?: number;

  @ApiProperty({ description: 'Bin identifier where item is stored' })
  @Expose()
  binId: string;

  @ApiProperty({ description: 'Human-readable bin name (e.g., A-1)' })
  @Expose()
  binName: string;

  @ApiProperty({ description: 'Due date for item expiration/calibration', type: Date, nullable: true })
  @Expose()
  @Type(() => Date)
  dueDate: Date | null;

  @ApiProperty({ description: 'Whether the item can be issued to users' })
  @Expose()
  canIssue: boolean;
}

export class ReturnableItemResponse extends BaseItemRecordDto {
  @ApiProperty({ description: 'Quantity that was issued to the user' })
  @Expose()
  issueQuantity: number;

  @ApiProperty({
    description: 'List of bin locations where items can be returned (e.g., ["A-1", "B-2"])',
    type: [String],
  })
  @Expose()
  locations: string[];

  @ApiProperty({
    description: 'Detailed item information including batch, serial, and due dates',
    type: [ItemInfoDto],
  })
  @Expose()
  @Type(() => ItemInfoDto)
  itemInfo: ItemInfoDto[];

  @ApiProperty({
    description: 'Associated working orders for this item',
    required: false,
    type: [Object],
  })
  @Expose()
  workingOrders?: any[];
}

export class ReplenishableItemResponse extends BaseItemRecordDto {
  @ApiProperty({ description: 'Current total quantity in the system' })
  @Expose()
  totalQuantity: number;

  @ApiProperty({ description: 'Total calculated/calibrated quantity' })
  @Expose()
  totalCalcQuantity: number;

  @ApiProperty({ description: 'Bin identifier where item can be replenished' })
  @Expose()
  binId: string;

  @ApiProperty({ description: 'Whether the item can be replenished (has available space)' })
  @Expose()
  canReplenish: boolean;
}
