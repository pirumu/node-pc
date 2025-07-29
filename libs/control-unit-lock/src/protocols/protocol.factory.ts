import { CuProtocol } from './cu';
import { ProtocolType } from './protocol.constants';
import { BaseResponse, IProtocol } from './protocol.interface';
import { ScuProtocol } from './scu';

export class ProtocolFactory {
  public static createProtocol(type: ProtocolType): IProtocol<BaseResponse> {
    switch (type) {
      case ProtocolType.CU:
        return new CuProtocol();
      case ProtocolType.SCU:
        return new ScuProtocol();
      default:
        throw new Error(`Unsupported protocol type: ${type}`);
    }
  }
}
