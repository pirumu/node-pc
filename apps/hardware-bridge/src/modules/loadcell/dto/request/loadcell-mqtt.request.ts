import { Type } from 'class-transformer';

export class LoadcellMqttRequest {
  @Type(() => String)
  binId: string;

  @Type(() => String)
  deviceId: string;
}
