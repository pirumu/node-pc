import { BaseController } from '@framework/controller';
import { ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { HEADER_KEYS } from '../../../common';

import { DEVICE_ROUTES } from './device.constants';
import { DeviceService } from './device.service';
import {
  ActiveDevicesRequest,
  AddLabelRequest,
  GetDeviceDetailRequest,
  GetDevicesByAppRequest,
  GetDevicesByPortRequest,
  RemoveLabelRequest,
  UnassignDevicesRequest,
  UpdateDeviceRequest,
} from './dtos/request';

@ControllerDocs({
  tag: '[INVENTORY] Device',
  securitySchema: 'header',
  securityKey: HEADER_KEYS.DEVICE_KEY,
})
@Controller(DEVICE_ROUTES.GROUP)
export class DeviceController extends BaseController {
  constructor(private readonly _deviceService: DeviceService) {
    super();
  }

  @Get(DEVICE_ROUTES.GET_DETAIL_DEVICE)
  public async getDetailDevice(@Query() query: GetDeviceDetailRequest): Promise<{ success: boolean; device: any }> {
    const device = await this._deviceService.getDetail(query);

    return {
      success: true,
      device,
    };
  }

  @Post(DEVICE_ROUTES.UPDATE)
  public async update(@Body() updateData: UpdateDeviceRequest): Promise<{ success: boolean; data?: any; message?: string }> {
    // const result = await this._deviceService.update(updateData);

    return { success: true, data: null };
  }

  @Get(DEVICE_ROUTES.GET_DEVICES_BY_APP)
  public async getDevicesByApp(@Query() query: GetDevicesByAppRequest): Promise<any> {
    const devices = await this._deviceService.getByApp(query);
    return devices;
  }

  @Get(DEVICE_ROUTES.GET_DEVICES_BY_PORT)
  public async getDevicesByPort(@Query() query: GetDevicesByPortRequest): Promise<{ success: boolean; data: any }> {
    const data = await this._deviceService.getByPort(query);

    return {
      success: true,
      data,
    };
  }

  @Post(DEVICE_ROUTES.ACTIVE)
  public async active(@Query() data: ActiveDevicesRequest): Promise<boolean> {
    return this._deviceService.active(data);
  }

  @Post(DEVICE_ROUTES.UNASSIGN)
  public async unassign(@Query() data: UnassignDevicesRequest): Promise<boolean> {
    return this._deviceService.unassign(data);
  }

  @Post(DEVICE_ROUTES.ADD_LABEL)
  public async addLabel(@Body() data: AddLabelRequest): Promise<boolean> {
    return this._deviceService.addLabel(data);
  }

  @Post(DEVICE_ROUTES.REMOVE_LABEL)
  public async removeLabel(@Body() data: RemoveLabelRequest): Promise<boolean> {
    return this._deviceService.removeLabel(data);
  }
}
