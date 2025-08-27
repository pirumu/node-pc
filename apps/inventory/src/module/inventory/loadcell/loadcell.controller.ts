import { PaginationResponse, StatusResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { HEADER_KEYS } from '../../../common';

import { CalibrateLoadcellRequest, GetLoadCellsRequest } from './dtos/request';
import { GetLoadcellsResponse } from './dtos/response';
import { LOADCELL_ROUTES } from './loadcell.constants';
import { LoadcellService } from './loadcell.service';

@ControllerDocs({
  tag: 'Loadcell',
  securitySchema: 'header',
  securityKey: HEADER_KEYS.DEVICE_KEY,
})
@Controller(LOADCELL_ROUTES.GROUP)
export class LoadcellController extends BaseController {
  constructor(private readonly _loadcellService: LoadcellService) {
    super();
  }

  @ApiDocs({
    summary: 'Get loadcells',
    paginatedResponseSchema: GetLoadcellsResponse,
  })
  @Get(LOADCELL_ROUTES.GET_LOADCELLS)
  public async getLoadCells(@Query() query: GetLoadCellsRequest): Promise<PaginationResponse<GetLoadcellsResponse>> {
    const { rows, meta } = await this._loadcellService.getLoadCells(query);
    return new PaginationResponse(
      rows.map((r) => this.toDto<GetLoadcellsResponse>(GetLoadcellsResponse, r.toPOJO())),
      meta,
    );
  }

  @ApiDocs({
    summary: 'Get loadcell',
    responseSchema: GetLoadcellsResponse,
  })
  @Get(LOADCELL_ROUTES.GET_LOADCELL)
  public async getLoadCell(@Param('id') loadcellId: string): Promise<GetLoadcellsResponse> {
    const entity = await this._loadcellService.getLoadCell(loadcellId);
    return this.toDto<GetLoadcellsResponse>(GetLoadcellsResponse, entity.toPOJO());
  }

  @ApiDocs({
    summary: 'Calibrate loadcell',
    responseSchema: StatusResponse,
  })
  @Post(LOADCELL_ROUTES.CALIBRATE_LOADCELL)
  public async calibrate(@Param('id') loadCellId: string, @Body() body: CalibrateLoadcellRequest): Promise<StatusResponse> {
    const isSuccess = await this._loadcellService.calibrate(loadCellId, body);
    return this.toDto<StatusResponse>(StatusResponse, { status: isSuccess });
  }

  @ApiDocs({
    summary: 'Activate loadcell',
    responseSchema: StatusResponse,
  })
  @Post(LOADCELL_ROUTES.ACTIVATE_LOADCELL)
  public async activate(@Param('id') loadCellId: string): Promise<StatusResponse> {
    const isSuccess = await this._loadcellService.activate(loadCellId);
    return this.toDto<StatusResponse>(StatusResponse, { status: isSuccess });
  }

  @ApiDocs({
    summary: 'Unassign loadcell',
    responseSchema: StatusResponse,
  })
  @Post(LOADCELL_ROUTES.UNASSIGN_LOADCELL)
  public async unassign(@Param('id') loadCellId: string): Promise<StatusResponse> {
    const isSuccess = await this._loadcellService.unassign(loadCellId);

    return this.toDto<StatusResponse>(StatusResponse, { status: isSuccess });
  }
}
