import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform, Expose } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, ValidateNested, ArrayMinSize, IsPositive, IsMongoId } from 'class-validator';

export class WorkingOrder {
  @ApiProperty({ description: 'Working order id' })
  @IsMongoId()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  workingOrderId: string;

  @ApiProperty({ description: 'Area id' })
  @IsMongoId()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  areaId: string;
}

export class RequestItem {
  @ApiProperty({ description: 'Item id' })
  @IsMongoId()
  @Type(() => String)
  itemId: string;

  @ApiProperty({ description: 'Quantity to issue' })
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseInt(value))
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ description: 'Condition id' })
  @IsNumber()
  @IsMongoId()
  @Expose({ toClassOnly: true })
  @IsOptional()
  conditionId?: string;

  @ApiProperty({
    type: [WorkingOrder],
    required: false,
    description: 'List of working orders (for torque items)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingOrder)
  @IsOptional()
  workingOrders?: WorkingOrder[] = [];
}

export class ItemRequest {
  @ApiProperty({
    type: [RequestItem],
    description: 'Array of items',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one item is required' })
  @ValidateNested({ each: true })
  @Type(() => RequestItem)
  @Expose({ toClassOnly: true })
  items: RequestItem[];
}
