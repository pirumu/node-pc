import { PaginationResponse, StatusResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';

import { HEADER_KEYS } from '../../../common';

import { GetPortsLoadcellsRequest, GetPortsRequest, UpdatePortNameRequest } from './dtos/request';
import { GetPortsLoadcellsResponse, GetPortsResponse } from './dtos/response';
import { PORT_ROUTES } from './port.constants';
import { PortService } from './port.service';

@ControllerDocs({
  tag: ' Port',
  securitySchema: 'header',
  securityKey: HEADER_KEYS.DEVICE_KEY,
})
@Controller(PORT_ROUTES.GROUP)
export class PortController extends BaseController {
  constructor(private readonly _portService: PortService) {
    super();
  }

  @ApiDocs({
    summary: 'Get ports',
    paginatedResponseSchema: GetPortsResponse,
  })
  @Get(PORT_ROUTES.GET_PORTS)
  public async getPorts(@Query() query: GetPortsRequest): Promise<PaginationResponse<GetPortsResponse>> {
    const { rows, meta } = await this._portService.getPorts(query.page || 1, query.limit || 10, { status: query.status });
    const data = rows.map((port) => this.toDto<GetPortsResponse>(GetPortsResponse, port.toPOJO()));
    return new PaginationResponse(data, meta);
  }

  @ApiDocs({
    summary: 'Get ports loadcells',
    paginatedResponseSchema: GetPortsLoadcellsResponse,
  })
  @Get(PORT_ROUTES.GET_PORTS_LOADCELLS)
  public async getPortsLoadcells(@Query() query: GetPortsLoadcellsRequest): Promise<PaginationResponse<GetPortsLoadcellsResponse>> {
    const { rows, meta } = await this._portService.getPorts(
      query.page || 1,
      query.limit || 10,
      {
        status: query.status,
        portId: query.portId,
      },
      true,
    );
    const data = rows.map((port) => this.toDto<GetPortsLoadcellsResponse>(GetPortsLoadcellsResponse, port.toPOJO()));
    return new PaginationResponse(data, meta);
  }

  @ApiDocs({
    summary: 'Update port name',
    responseSchema: StatusResponse,
  })
  @Post(PORT_ROUTES.UPDATE_PORT_NAME)
  public async updatePortNameById(@Param('id') portId: string, @Body() body: UpdatePortNameRequest): Promise<StatusResponse> {
    const isSuccess = await this._portService.updatePortName(portId, body.name);
    return this.toDto<StatusResponse>(StatusResponse, { status: isSuccess });
  }

  @ApiDocs({
    summary: 'Reset ports name to default',
    responseSchema: StatusResponse,
  })
  @Put(PORT_ROUTES.RESET_PORT_NAME)
  public async resetPortNames(): Promise<StatusResponse> {
    const isSuccess = await this._portService.resetPortNames();
    return this.toDto<StatusResponse>(StatusResponse, { status: isSuccess });
  }
}
