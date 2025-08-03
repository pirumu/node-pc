import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform, Expose } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, ValidateNested, ArrayMinSize, IsPositive, IsMongoId } from 'class-validator';

export class WOItemDto {
  @ApiProperty({ description: 'Work Order ID', name: 'wo_id' })
  @IsMongoId()
  @Type(() => String)
  @Expose({ name: 'wo_id', toClassOnly: true })
  woId: string;

  @ApiProperty({ description: 'Area ID', name: 'area_id' })
  @IsMongoId()
  @Type(() => String)
  @Expose({ name: 'area_id', toClassOnly: true })
  areaId: string;
}

export class RequestIssueItemDto {
  @ApiProperty({ description: 'Item ID' })
  @IsMongoId()
  @Type(() => String)
  itemId: string;

  @ApiProperty({ description: 'Quantity to issue' })
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseInt(value))
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    required: false,
    description: 'Item condition status',
  })
  @IsOptional()
  @Type(() => String)
  status?: string;

  @ApiProperty({
    type: [WOItemDto],
    description: 'List of Work Orders (for torque items)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WOItemDto)
  @IsOptional()
  listWO: WOItemDto[];

  @ApiProperty({ description: 'Condition ID', name: 'condition_id' })
  @IsNumber()
  @IsMongoId()
  @Expose({ name: 'condition_id', toClassOnly: true })
  @IsOptional()
  conditionId: string;

  @ApiProperty({ description: 'Bin ID', required: false })
  @IsMongoId()
  @IsOptional()
  binId?: string;
}

export class IssueItemRequest {
  @ApiProperty({
    type: [RequestIssueItemDto],
    description: 'Array of items to issue',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one item is required' })
  @ValidateNested({ each: true })
  @Type(() => RequestIssueItemDto)
  items: RequestIssueItemDto[];
}
