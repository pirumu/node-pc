import { Properties } from '@framework/types';

import { Command, ProtocolType } from '../protocols';

export class CuLockRequest {
  public command?: Command;

  public deviceId: number;

  public lockIds: number[];

  public protocol: ProtocolType;

  constructor(props: Properties<CuLockRequest>) {
    Object.assign(this, props);
  }
}
