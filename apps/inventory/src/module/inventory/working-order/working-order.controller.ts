import { PaginationResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { WsGateway } from '../../ws';

import { UpdateWorkingOrderRequest } from './dtos/request';
import { WorkingOrderResponse } from './dtos/response';
import { WorkingOrderService } from './working-order.service';

@ControllerDocs({
  tag: 'Working Order',
})
@Controller('working-orders')
export class WorkingOrderController extends BaseController {
  constructor(
    private readonly _wsGateway: WsGateway,
    private readonly _workingOrderService: WorkingOrderService,
  ) {
    super();
  }

  @ApiDocs({
    responseSchema: WorkingOrderResponse,
  })
  @Get('/:code')
  public async getWorkingOrderByCode(@Param('code') code: string): Promise<WorkingOrderResponse> {
    const result = await this._workingOrderService.getWorkingOrderByCode(code);
    return new WorkingOrderResponse({
      id: result.id,
      wo: result.wo || '',
      vehicleNum: result.vehicleNum || '',
      vehicleType: result.vehicleType || '',
      platform: result.platform || '',
      cardNumber: result.code || '',
    });
  }

  @ApiDocs({
    responseSchema: WorkingOrderResponse,
  })
  @Post('/:id')
  public async update(@Param('id') id: string, @Body() data: UpdateWorkingOrderRequest): Promise<WorkingOrderResponse> {
    const result = await this._workingOrderService.updateWorkingOrder(id, data);
    return new WorkingOrderResponse({
      id: result.id,
      wo: result.wo || '',
      vehicleNum: result.vehicleNum || '',
      vehicleType: result.vehicleType || '',
      platform: result.platform || '',
      cardNumber: result.code || '',
    });
  }

  @ApiDocs({
    paginatedResponseSchema: WorkingOrderResponse,
  })
  @Get('/')
  public async getWorkingOrders(): Promise<PaginationResponse<WorkingOrderResponse>> {
    const { rows, meta } = await this._workingOrderService.getWorkingOrders({ page: 1, limit: 100 });
    const results = rows.map((result) =>
      this.toDto(WorkingOrderResponse, {
        id: result.id,
        wo: result.wo || '',
        vehicleNum: result.vehicleNum || '',
        vehicleType: result.vehicleType || '',
        platform: result.platform || '',
        cardNumber: result.code || '',
      }),
    );
    return new PaginationResponse(results, meta);
  }
}
