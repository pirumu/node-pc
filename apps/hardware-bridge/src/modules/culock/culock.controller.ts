import { CuLockRequest } from '@culock/dto';
import { BaseResponse } from '@culock/protocols';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CulockService } from './culock.service';
import { LockMonitoringService } from './lock-tracking.service';

@Controller()
export class CulockController {
  constructor(
    private readonly _culockService: CulockService,
    private readonly _lockMonitoringService: LockMonitoringService,
  ) {}

  @MessagePattern('cu/open')
  public async open(@Payload() cuOpenRequest: CuLockRequest): Promise<BaseResponse> {
    return this._culockService.open(cuOpenRequest);
  }

  @MessagePattern('cu/status')
  public async status(@Payload() cuOpenRequest: CuLockRequest): Promise<BaseResponse> {
    return this._culockService.status(cuOpenRequest);
  }

  @MessagePattern('lock/track')
  public async track(@Payload() cuOpenRequest: CuLockRequest): Promise<void> {
    return this._lockMonitoringService.track(cuOpenRequest);
  }
}
