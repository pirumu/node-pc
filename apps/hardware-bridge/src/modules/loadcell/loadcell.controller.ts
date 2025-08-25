import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { LoadcellRequest } from './dto/request';
import { LoadcellBridgeService } from './loadcell-bridge.service';

@Controller()
export class LoadcellController {
  constructor(private readonly _loadcellBridgeService: LoadcellBridgeService) {}

  @EventPattern(EVENT_TYPE.LOADCELL.START_READING)
  public async startReading(@Payload() payload: LoadcellRequest): Promise<void> {
    if (payload.forceReset) {
      return this._loadcellBridgeService.forceStartReading(payload.hardwareIds);
    }
    return this._loadcellBridgeService.startReading(payload.hardwareIds);
  }

  @EventPattern(EVENT_TYPE.LOADCELL.STOP_READING)
  public async stopReading(@Payload() payload: LoadcellRequest): Promise<void> {
    return this._loadcellBridgeService.stopReading(payload.hardwareIds);
  }

  @EventPattern(EVENT_TYPE.LOADCELL.ACTIVATED)
  public async onDeviceActive(@Payload() payload: LoadcellRequest): Promise<void> {
    return this._loadcellBridgeService.onActiveDevice(payload.hardwareIds);
  }
}
