import { PaginationResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Controller, Get, Param, Query } from '@nestjs/common';

import { HEADER_KEYS } from '../../../common';

import { CABINET_ROUTES } from './cabinet.constants';
import { CabinetService } from './cabinet.service';
import { GetCabinetsRequest } from './dtos/request';
import { GetCabinetResponse, GetCabinetsResponse } from './dtos/response';

@ControllerDocs({
  tag: 'Cabinet',
  securitySchema: 'header',
  securityKey: HEADER_KEYS.DEVICE_KEY,
})
@Controller(CABINET_ROUTES.GROUP)
export class CabinetController extends BaseController {
  constructor(private readonly _cabinetService: CabinetService) {
    super();
  }

  @ApiDocs({
    responseSchema: [GetCabinetsResponse],
  })
  @Get(CABINET_ROUTES.GET_CABINETS)
  public async getCabinets(@Query() queries: GetCabinetsRequest): Promise<GetCabinetsResponse[]> {
    const result = await this._cabinetService.getCabinets(queries);
    return result.map((cabinet) => {
      const pojo = cabinet.toPOJO();

      return this.toDto<GetCabinetsResponse>(GetCabinetsResponse, {
        ...pojo,
        siteId: pojo.site,
      });
    });
  }

  @ApiDocs({
    responseSchema: GetCabinetResponse,
  })
  @Get(CABINET_ROUTES.GET_CABINET)
  public async getCabinet(@Param('id') id: string): Promise<GetCabinetResponse> {
    const result = await this._cabinetService.getCabinetById(id);
    return this.toDto<GetCabinetResponse>(GetCabinetResponse, result.toPOJO());
  }
}
