import { Properties } from '@framework/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class WorkingOrderResponse {
  @ApiProperty()
  @Expose({})
  @Type(() => String)
  id: string;

  @ApiProperty()
  @Expose({})
  @Type(() => String)
  wo: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({})
  @Type(() => String)
  vehicleNum: string;

  @ApiProperty()
  @Expose({})
  @Type(() => String)
  vehicleType: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({})
  platform: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({})
  cardNumber: string;

  constructor(props: Properties<WorkingOrderResponse>) {
    Object.assign(this, props);
  }
}
