import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class ItemResponse {
  @ApiProperty()
  @Expose({ name: 'id' })
  id: number;

  @ApiProperty()
  @Expose({ name: 'name' })
  name: string;

  @ApiProperty()
  @Expose({ name: 'part_no' })
  partNo: string;

  @ApiProperty()
  @Expose({ name: 'material_no' })
  materialNo: string;

  @ApiProperty()
  @Expose({ name: 'location' })
  location: string;

  @ApiProperty({ enum: ['torque_wrench', '....'] })
  @Expose({ name: 'type' })
  type: string;

  @ApiProperty()
  @Expose({ name: 'label' })
  label: string;

  @ApiProperty()
  @Expose({ name: 'charge_time' })
  chargeTime: string;

  @ApiProperty()
  @Expose({ name: 'due_date' })
  dueDate: string;

  @ApiProperty()
  @Expose({ name: 'expiry_date' })
  expiryDate: string;

  @ApiProperty({ required: false })
  @Expose({ name: 'image' })
  image?: string;

  @ApiProperty()
  @Expose({ name: 'serial' })
  serial: string;

  @ApiProperty()
  @Expose({ name: 'description' })
  description: string;

  @ApiProperty({ enum: ['available'] })
  @Expose({ name: 'status' })
  status: string;

  @ApiProperty()
  @Expose({ name: 'createdAt' })
  @Transform(({ value }) => value?.toISOString())
  createdAt: string;

  @ApiProperty()
  @Expose({ name: 'updatedAt' })
  @Transform(({ value }) => value?.toISOString())
  updatedAt: string;

  @ApiProperty()
  @Expose({ name: 'total_quantity' })
  totalQuantity: number;

  @ApiProperty()
  @Expose({ name: 'total_calc_quantity' })
  totalCalcQuantity: number;

  @ApiProperty({ required: false })
  @Expose({ name: 'list_wo' })
  listWo?: string;

  @ApiProperty({ required: false })
  @Expose({ name: 'bin_id' })
  binId?: number;

  @ApiProperty({ required: false })
  @Expose({ name: 'issue_quantity' })
  issueQuantity?: number;

  @ApiProperty({ type: [String] })
  @Expose({ name: 'locations' })
  locations: string[];

  @ApiProperty({ required: false })
  @Expose({ name: 'item_type_id' })
  itemTypeId?: number;
}
