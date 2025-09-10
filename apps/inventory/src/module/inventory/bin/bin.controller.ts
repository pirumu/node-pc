import { CLIENT_ID_KEY } from '@common/constants';
import { PaginationResponse, StatusResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';

import { BIN_ROUTES } from './bin.constants';
import { BinService } from './bin.service';
import { OpenCabinetBinRequest, GetBinsRequest, GetBinRequest } from './dtos/request';
import { GetBinCompartmentDetail, GetBinCompartmentsResponse, GetBinResponse } from './dtos/response';

@ControllerDocs({
  tag: 'Bin',
  securitySchema: 'header',
  securityKey: CLIENT_ID_KEY,
})
@Controller(BIN_ROUTES.GROUP)
export class BinController extends BaseController {
  constructor(private readonly _binService: BinService) {
    super();
  }

  @ApiDocs({
    summary: 'Get bins',
    paginatedResponseSchema: GetBinResponse,
  })
  @Get(BIN_ROUTES.GET_BINS)
  public async getBins(@Query() query: GetBinsRequest): Promise<PaginationResponse<GetBinResponse>> {
    const { rows, meta } = await this._binService.getBins(query.page || 1, query.limit || 10, query.cabinetId, query.siteId, query.enrich);
    const data = rows.map((row) => this.toDto<GetBinResponse>(GetBinResponse, row.toPOJO()));
    return new PaginationResponse(data, meta);
  }

  @ApiDocs({
    summary: 'Get bin compartments',
    paginatedResponseSchema: GetBinCompartmentsResponse,
  })
  @Get(BIN_ROUTES.GET_BIN_COMPARTMENTS)
  public async getBinCompartments(@Query() query: GetBinsRequest): Promise<PaginationResponse<GetBinCompartmentsResponse>> {
    const { rows, meta } = await this._binService.getBinCompartments(query.page || 1, query.limit || 10, {
      cabinetId: query.cabinetId,
      siteId: query.siteId,
      binId: query.binId,
    });
    const data = rows.map((row) =>
      this.toDto<GetBinCompartmentsResponse>(GetBinCompartmentsResponse, {
        ...row,
        totalQtyOH: row.totalQtyOH || 0,
        index: row.index || 0,
      }),
    );
    return new PaginationResponse(data, meta);
  }

  @ApiDocs({
    summary: 'Get bin compartment details',
    responseSchema: GetBinCompartmentDetail,
  })
  @Get(BIN_ROUTES.GET_BIN_COMPARTMENT_DETAIL)
  public async getBinCompartmentDetail(@Param('id') binId: string): Promise<GetBinCompartmentDetail> {
    const result = await this._binService.getCompartmentDetails(binId);
    return this.toDto<GetBinCompartmentDetail>(GetBinCompartmentDetail, {
      ...result,
      totalQtyOH: result.totalQtyOH || 0,
      index: result.index || 0,
    });
  }

  @ApiDocs({
    summary: 'Get bin by id',
    responseSchema: GetBinResponse,
  })
  @Get(BIN_ROUTES.GET_BIN_BY_ID)
  public async getBinById(@Param('id') id: string, @Query() query: GetBinRequest): Promise<GetBinResponse> {
    const result = await this._binService.getBinById(id, query.enrich);

    return this.toDto<GetBinResponse>(GetBinResponse, result.toPOJO());
  }

  @ApiDocs({
    summary: 'Open bin by id',
    responseSchema: StatusResponse,
  })
  @Post(BIN_ROUTES.OPEN_BIN)
  public async openBinById(@Param('id') id: string): Promise<StatusResponse> {
    const isSuccess = await this._binService.open(id);
    return this.toDto<StatusResponse>(StatusResponse, { status: isSuccess });
  }

  @ApiDocs({
    summary: "Open cabinet's bins",
    responseSchema: StatusResponse,
  })
  @Post(BIN_ROUTES.OPEN_BINS)
  public async openCabinetBins(@Body() body: OpenCabinetBinRequest): Promise<StatusResponse> {
    const isSuccess = await this._binService.openCabinetBins(body);
    return this.toDto<StatusResponse>(StatusResponse, { status: isSuccess });
  }

  @ApiDocs({
    summary: 'Activate Bin',
    responseSchema: StatusResponse,
  })
  @Put(BIN_ROUTES.ACTIVATE_BIN)
  public async activateBin(@Param('id') id: string): Promise<StatusResponse> {
    const isSuccess = await this._binService.activate(id);
    return this.toDto<StatusResponse>(StatusResponse, { status: isSuccess });
  }

  @ApiDocs({
    summary: 'Deactivate Bin',
    responseSchema: StatusResponse,
  })
  @Put(BIN_ROUTES.DEACTIVATE_BIN)
  public async deactivateBin(@Param('id') id: string): Promise<StatusResponse> {
    const isSuccess = await this._binService.deactivate(id);
    return this.toDto<StatusResponse>(StatusResponse, { status: isSuccess });
  }
}
