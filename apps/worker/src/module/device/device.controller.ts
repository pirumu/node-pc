import { WeightCalculatedEvent } from '@common/business/events';
import { EVENT_TYPE } from '@common/constants';
import { TracingID } from '@framework/decorators';
import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { DeviceWorkerService } from './device.service';

@Controller()
export class DeviceController {
  private readonly _logger = new Logger(DeviceController.name);
  constructor(private readonly _worker: DeviceWorkerService) {}

  @MessagePattern(EVENT_TYPE.LOAD_CELLS_WEIGHT_CALCULATED)
  public async onDeviceSendWeight(@TracingID() tracingId: string, @Payload() event: WeightCalculatedEvent): Promise<void> {
    this._logger.log('Device send weight', { tracingId });
    await this._worker.updateWeight(event);
  }
}
