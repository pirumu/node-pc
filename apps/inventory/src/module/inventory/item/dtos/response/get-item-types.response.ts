import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ItemTypeCategoryType } from '@dals/mongo/entities/item-type.entity';

export class GetItemTypesResponse {
  @ApiProperty()
  @Type(() => String)
  @Expose()
  id: string;

  @ApiProperty()
  @Type(() => String)
  @Expose()
  name: string;

  @ApiProperty()
  @Type(() => String)
  @Expose()
  category: ItemTypeCategoryType;

  @ApiProperty()
  @Type(() => String)
  @Expose()
  description?: string;

  @ApiProperty()
  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Type(() => Date)
  @Expose()
  updatedAt?: Date;
}
