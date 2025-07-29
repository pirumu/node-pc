import { MqttTracingID } from '@framework/decorators';
import { Logger, Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { LoadcellMqttRequest } from './dto/request';
import { LoadcellBridgeService } from './loadcell-bridge.service';

@Controller()
export class LoadcellMqttController {
  private readonly _logger = new Logger(LoadcellMqttController.name);

  constructor(private readonly _loadcellBridgeService: LoadcellBridgeService) {}

  @MessagePattern('bin/open')
  public async onBinOpen(@MqttTracingID() tracingId: string, @Payload() payload: LoadcellMqttRequest): Promise<void> {
    this._logger.log(`Received bin/open request with tracing id ${tracingId}`);
    return this._loadcellBridgeService.onBinOpened(payload);
  }

  @MessagePattern('bin/close')
  public async onBinClose(@MqttTracingID() tracingId: string, @Payload() payload: LoadcellMqttRequest): Promise<void> {
    this._logger.log(`Received bin/close request with tracing id ${tracingId}`);
    return this._loadcellBridgeService.onBinClosed(payload);
  }

  @MessagePattern('device/active')
  public async onDeviceActive(@MqttTracingID() tracingId: string, @Payload() payload: LoadcellMqttRequest): Promise<void> {
    this._logger.log(`Received device/active request with tracing id ${tracingId}`);
    return this._loadcellBridgeService.onActiveDevice(payload);
  }
}
