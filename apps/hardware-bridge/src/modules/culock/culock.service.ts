import { ControlUnitLockService } from '@culock';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CulockService {
  constructor(private readonly _controlUnitLockService: ControlUnitLockService) {}

  public async open(request: any) {
    return this._controlUnitLockService.execute(request);
  }

  public async status(request: any) {
    return this._controlUnitLockService.execute(request);
  }

  public async track(request: any) {}
}
