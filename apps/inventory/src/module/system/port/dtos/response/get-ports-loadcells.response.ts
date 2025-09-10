import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { GetPortsResponse } from './get-ports.response';

export class LoadcellState {
  @ApiProperty()
  @Type(() => Boolean)
  @Expose({ toClassOnly: true })
  isUpdatedWeight: boolean;

  @ApiProperty()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  status: string;

  @ApiProperty()
  @Type(() => Boolean)
  @Expose({ toClassOnly: true })
  isCalibrated: boolean;
}

export class CalibrationData {
  @ApiProperty()
  @Type(() => Number)
  @Expose({ toClassOnly: true })
  quantity: number;

  @ApiProperty()
  @Type(() => Number)
  @Expose({ toClassOnly: true })
  maxQuantity: number;

  @ApiProperty()
  @Type(() => Number)
  @Expose({ toClassOnly: true })
  zeroWeight: number;

  @ApiProperty()
  @Type(() => Number)
  @Expose({ toClassOnly: true })
  unitWeight: number;

  @ApiProperty()
  @Type(() => Number)
  @Expose({ toClassOnly: true })
  damageQuantity: number;
}

export class LoadcellsResponse {
  @ApiProperty()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  id: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  name: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  label: string;

  @ApiProperty()
  @Type(() => String)
  @Expose({ toClassOnly: true })
  code: string;

  @ApiProperty()
  @Type(() => Number)
  @Expose({ toClassOnly: true })
  hardwareId: number;

  @ApiProperty()
  @Type(() => CalibrationData)
  @Expose({ toClassOnly: true })
  calibration: CalibrationData;

  @ApiProperty()
  @Type(() => LoadcellState)
  @Expose({ toClassOnly: true })
  state: LoadcellState;
}

export class GetPortsLoadcellsResponse extends GetPortsResponse {
  @ApiProperty()
  @Type(() => LoadcellsResponse)
  @Expose({ toClassOnly: true })
  loadcells: LoadcellsResponse[];
}
