import { EVENT_TYPE } from '@common/constants';
import { CuLockRequest } from '@culock/dto';
import { Command } from '@culock/protocols';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { LockTrackerService } from './lock-tracker.service';

@Controller()
export class LockTrackerController {
  constructor(private readonly _lockMonitoringService: LockTrackerService) {}

  @EventPattern(EVENT_TYPE.LOCK.TRACKING)
  public async track(@Payload() request: CuLockRequest): Promise<void> {
    request.command = Command.GET_STATUS;
    return this._lockMonitoringService.track(request);
  }
}
