import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

export class ItemResponse {
  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'id', toPlainOnly: true })
  id: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'name', toPlainOnly: true })
  name: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'part_no', toPlainOnly: true })
  partNo: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'material_no', toPlainOnly: true })
  materialNo: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'location', toPlainOnly: true })
  location: string[];

  @ApiProperty({ enum: ['torque_wrench', '....'] })
  @Type(() => String)
  @Expose({ name: 'type', toPlainOnly: true })
  type: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'label', toPlainOnly: true })
  label: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'charge_time', toPlainOnly: true })
  chargeTime: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'due_date', toPlainOnly: true })
  dueDate: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'expiry_date', toPlainOnly: true })
  expiryDate: string;

  @ApiProperty({ required: false })
  @Type(() => String)
  @Expose({ name: 'image', toPlainOnly: true })
  image?: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'serial', toPlainOnly: true })
  serial: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'description', toPlainOnly: true })
  description: string;

  @ApiProperty({ enum: ['available'] })
  @Type(() => String)
  @Expose({ name: 'status', toPlainOnly: true })
  status: string;

  @ApiProperty({ name: 'createdAt' })
  @Type(() => String)
  @Expose({ name: 'createdAt', toPlainOnly: true })
  createdAt: string;

  @ApiProperty({ name: 'updatedAt' })
  @Type(() => String)
  @Expose({ name: 'updatedAt', toPlainOnly: true })
  updatedAt: string;

  @ApiProperty({ name: 'total_quantity' })
  @Type(() => Number)
  @Expose({ name: 'total_quantity', toPlainOnly: true })
  totalQuantity: number;

  @ApiProperty({ name: 'total_calc_quantity' })
  @Type(() => Number)
  @Expose({ name: 'total_calc_quantity', toPlainOnly: true })
  totalCalcQuantity: number;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @Expose({ name: 'list_wo', toPlainOnly: true })
  listWo?: string;

  @ApiProperty({ required: false })
  @Type(() => String)
  @Expose({ name: 'bin_id', toPlainOnly: true })
  binId?: string;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @Expose({ name: 'issue_quantity', toPlainOnly: true })
  issueQuantity?: number;

  @ApiProperty({ type: [String] })
  @Type(() => String)
  @Expose({ name: 'locations', toPlainOnly: true })
  locations: string[];

  @ApiProperty({ required: false })
  @Type(() => String)
  @Expose({ name: 'item_type_id', toPlainOnly: true })
  itemTypeId?: string;
}
