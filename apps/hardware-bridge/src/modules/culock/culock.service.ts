import { ControlUnitLockWithMutexService } from '@culock';
import { CuLockRequest } from '@culock/dto';
import { BaseResponse } from '@culock/protocols';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CulockService {
  constructor(private readonly _controlUnitLockService: ControlUnitLockWithMutexService) {}

  public async open(request: CuLockRequest): Promise<BaseResponse> {
    return this._controlUnitLockService.execute(request);
  }

  public async status(request: CuLockRequest): Promise<BaseResponse> {
    return this._controlUnitLockService.execute(request);
  }
}
