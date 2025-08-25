import { PaginationResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Controller, Get, Query } from '@nestjs/common';

import { AREA_ROUTES } from './area.constants';
import { AreaService } from './area.service';
import { GetAreasRequest } from './dtos/request';
import { GetAreasResponse } from './dtos/response';

@ControllerDocs({
  tag: 'Area',
})
@Controller(AREA_ROUTES.GROUP)
export class AreaController extends BaseController {
  constructor(private readonly _areaService: AreaService) {
    super();
  }

  @ApiDocs({
    paginatedResponseSchema: GetAreasResponse,
  })
  @Get(AREA_ROUTES.GET_AREAS)
  public async getAreas(@Query() query: GetAreasRequest): Promise<PaginationResponse<GetAreasResponse>> {
    const { rows, meta } = await this._areaService.getAreas(query.page || 1, query.limit || 10);
    const results = rows.map((row) => this.toDto(GetAreasResponse, row.toPOJO()));
    return new PaginationResponse(results, meta);
  }
}
