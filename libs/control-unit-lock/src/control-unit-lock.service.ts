import { CuResponse } from '@culock/protocols/cu';
import { ScuResponse } from '@culock/protocols/scu/scu.types';
import { Injectable } from '@nestjs/common';
import { InjectSerialManager, ISerialAdapter } from '@serialport/serial';
import { lastValueFrom } from 'rxjs';

import { CuLockRequest } from './dto';
import { BaseResponse, IProtocol, ProtocolFactory, ProtocolType } from './protocols';

@Injectable()
export class ControlUnitLockService {
  constructor(@InjectSerialManager() private readonly _serialManager: ISerialAdapter) {}

  public async execute(request: CuLockRequest): Promise<BaseResponse> {
    const protocol = ProtocolFactory.createProtocol(request.protocol);

    if (this._isMultipleRequest(request)) {
      return this._handleMultipleRequest(request, protocol);
    }

    return this._handleSingleRequest(request, protocol);
  }

  private async _handleSingleRequest(request: CuLockRequest, protocol: IProtocol<BaseResponse>): Promise<ScuResponse> {
    const msg = protocol.createMessage({
      command: request.command,
      deviceId: request.deviceId,
      lockId: 0,
    });
    this._serialManager.write(request.path, msg);

    const response = await lastValueFrom(this._serialManager.onData(request.path));
    return protocol.parseResponse(Buffer.from(response));
  }

  private async _handleMultipleRequest(request: CuLockRequest, protocol: IProtocol<BaseResponse>): Promise<CuResponse> {
    const msgs = protocol.createMessages({
      command: request.command,
      deviceId: request.deviceId,
      lockIds: request.lockIds,
    });

    for (const msg of msgs) {
      this._serialManager.write(request.path, msg);
    }
    const response = await lastValueFrom(this._serialManager.onData(request.path));
    return protocol.parseResponse(Buffer.from(response));
  }

  private _isMultipleRequest(request: CuLockRequest): boolean {
    return request.protocol === ProtocolType.CU;
  }
}
