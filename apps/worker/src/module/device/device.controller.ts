import { WeightCalculatedEvent } from '@common/business/events';
import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { DeviceWorkerService } from './device.service';

@Controller()
export class DeviceController {
  constructor(private readonly _worker: DeviceWorkerService) {}

  @MessagePattern(EVENT_TYPE.LOAD_CELLS_WEIGHT_CALCULATED)
  public async onDeviceSendWeight(@Payload() event: WeightCalculatedEvent): Promise<void> {
    await this._worker.updateWeight(event);
  }
}
