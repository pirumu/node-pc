import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { HEADER_KEYS } from '../../../common';

import { GetPortsRequest, UpdatePortNameRequest } from './dtos/request';
import { GetPortsResponse } from './dtos/response';
import { PORT_ROUTES } from './port.constants';
import { PortService } from './port.service';

@ControllerDocs({
  tag: '[SYSTEM] Port',
  securitySchema: 'header',
  securityKey: HEADER_KEYS.DEVICE_KEY,
})
@Controller(PORT_ROUTES.GROUP)
export class PortController extends BaseController {
  constructor(private readonly _portService: PortService) {
    super();
  }

  @ApiDocs({
    responseSchema: [GetPortsResponse],
  })
  @Get(PORT_ROUTES.GET_PORTS)
  public async getPorts(@Query() queries: GetPortsRequest): Promise<GetPortsResponse[]> {
    const result = await this._portService.getPorts(queries);
    return result.map((port) => this.toDto<GetPortsResponse>(GetPortsResponse, port));
  }

  @ApiDocs({
    responseSchema: Boolean,
  })
  @Post(PORT_ROUTES.UPDATE_PORT_NAME)
  public async updatePortName(@Body() body: UpdatePortNameRequest): Promise<boolean> {
    return this._portService.updatePortName(body.portId, body.name);
  }

  @ApiDocs({
    responseSchema: Boolean,
  })
  @Post(PORT_ROUTES.RESET_PORT_NAME)
  public async resetPortNames(): Promise<boolean> {
    return this._portService.resetPortNames();
  }
}
