import { EVENT_TYPE } from '@common/constants';
import { CuLockRequest } from '@culock/dto';
import { BaseResponse, Command } from '@culock/protocols';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CulockService } from './culock.service';

@Controller()
export class CulockController {
  constructor(private readonly _culockService: CulockService) {}

  @MessagePattern(EVENT_TYPE.LOCK.OPEN)
  public async open(@Payload() request: CuLockRequest): Promise<BaseResponse> {
    request.command = Command.OPEN_LOCK;
    return this._culockService.open(request);
  }

  @MessagePattern(EVENT_TYPE.LOCK.STATUS)
  public async status(@Payload() request: CuLockRequest): Promise<BaseResponse> {
    request.command = Command.GET_STATUS;
    return this._culockService.status(request);
  }
}
