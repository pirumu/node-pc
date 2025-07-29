import { EVENT_TYPE } from '@common/constants';
import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';

export class LoadcellHeartbeatEvent implements IAppEvent {
  public readonly id: string;
  public readonly deviceId: number;
  public readonly isConnected: boolean;
  public readonly timestamp: number;

  constructor(props: Properties<LoadcellHeartbeatEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): string {
    return EVENT_TYPE.LOAD_CELLS_HEARTBEAT;
  }

  public getPayload(): any {
    return {
      id: this.id,
      deviceId: this.deviceId,
      isConnected: this.isConnected,
      timestamp: this.timestamp,
    };
  }
}
