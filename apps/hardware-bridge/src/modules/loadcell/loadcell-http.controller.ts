import { Controller, Get, Post } from '@nestjs/common';

import { LoadcellBridgeService } from './loadcell-bridge.service';

@Controller('loadcell')
export class LoadcellHttpController {
  constructor(private readonly _loadcellService: LoadcellBridgeService) {}

  @Get('status')
  public async getStatus(): Promise<any> {
    return this._loadcellService.getStatus();
  }

  @Get('devices')
  public async getDevices(): Promise<any> {
    return this._loadcellService.getDevices();
  }

  @Post('ports/scan')
  public async scanPorts(): Promise<any> {
    return this._loadcellService.scanPorts();
  }

  @Post('health/check')
  public async performHealthCheck(): Promise<any> {
    return this._loadcellService.performHealthCheck();
  }
}
