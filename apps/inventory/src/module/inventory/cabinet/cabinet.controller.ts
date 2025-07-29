import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Controller, Get, Param } from '@nestjs/common';

import { HEADER_KEYS } from '../../../common';

import { CABINET_ROUTES } from './cabinet.constants';
import { CabinetService } from './cabinet.service';
import { GetCabinetResponse, GetCabinetsResponse } from './dtos/response';

@ControllerDocs({
  tag: 'Device',
  securitySchema: 'header',
  securityKey: HEADER_KEYS.DEVICE_KEY,
})
@Controller(CABINET_ROUTES.GROUP)
export class CabinetController extends BaseController {
  constructor(private readonly _cabinetService: CabinetService) {
    super();
  }

  @ApiDocs({
    responseSchema: Array<GetCabinetsResponse>,
  })
  @Get(CABINET_ROUTES.GET_CABINETS)
  public async getCabinets(): Promise<GetCabinetsResponse[]> {
    const result = await this._cabinetService.getCabinets();
    return result.map((cabinet) => this.toDto<GetCabinetsResponse>(GetCabinetsResponse, cabinet));
  }

  @ApiDocs({
    responseSchema: GetCabinetResponse,
  })
  @Get(CABINET_ROUTES.GET_CABINET)
  public async getCabinet(@Param('id') id: string): Promise<GetCabinetResponse> {
    const result = await this._cabinetService.getCabinetById(id);
    return this.toDto<GetCabinetResponse>(GetCabinetResponse, result);
  }
}
