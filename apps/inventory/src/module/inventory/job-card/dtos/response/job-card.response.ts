import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class JobCardResponse {
  @ApiProperty()
  @Type(() => String)
  id: string;

  @ApiProperty()
  @Type(() => String)
  wo: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'vehicle_num', toPlainOnly: true })
  @Type(() => String)
  vehicleNum: string;

  @ApiProperty()
  @Expose({ name: 'vehicle_type', toPlainOnly: true })
  @Type(() => String)
  vehicleType: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'platform', toPlainOnly: true })
  platform: string;

  @ApiProperty()
  @Type(() => Number)
  @Expose({ name: 'status', toPlainOnly: true })
  status: number;

  @ApiProperty()
  @Type(() => String)
  @Expose({ name: 'card_number', toPlainOnly: true })
  cardNumber: string;
}
