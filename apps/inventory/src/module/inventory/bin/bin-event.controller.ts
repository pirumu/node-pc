import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';

import { BinService } from './bin.service';

@Controller()
export class BinEventController {
  constructor(private readonly _binService: BinService) {}
  @EventPattern(EVENT_TYPE.LOCK.TRACKING_STATUS)
  public async track(request: { cuLockId: number; isClosed: boolean; error?: string }): Promise<void> {
    return this._binService.close(request.cuLockId, request.isClosed, request.error);
  }
}
