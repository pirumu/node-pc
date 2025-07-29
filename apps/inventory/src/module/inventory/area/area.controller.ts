import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Controller, Get } from '@nestjs/common';

import { AREA_ROUTES } from './area.constants';
import { AreaService } from './area.service';
import { GetAreasResponse } from './dtos/response';

@ControllerDocs({
  tag: '[INVENTORY] Area',
})
@Controller(AREA_ROUTES.GROUP)
export class AreaController extends BaseController {
  constructor(private readonly _areaService: AreaService) {
    super();
  }

  @ApiDocs({
    responseSchema: [GetAreasResponse],
  })
  @Get(AREA_ROUTES.GET_AREAS)
  public async getAreas(): Promise<GetAreasResponse[]> {
    const result = await this._areaService.getAreas();
    return result.map((area) => this.toDto<GetAreasResponse>(GetAreasResponse, area));
  }
}
