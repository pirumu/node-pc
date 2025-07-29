import { EVENT_TYPE } from '@common/constants';
import { IAppEvent } from '@common/interfaces';
import { Properties } from '@framework/types';

export class WeighCalculatedEvent implements IAppEvent {
  public readonly path: string;
  public readonly deviceId: number;
  public readonly weight: number;
  public readonly status: string;
  public readonly timestamp: string;

  constructor(props: Properties<WeighCalculatedEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): string {
    return EVENT_TYPE.LOAD_CELLS_WEIGHT_CALCULATED;
  }

  public getPayload(): any {
    return {
      path: this.path,
      deviceId: this.deviceId,
      weight: this.weight,
      status: this.status,
      timestamp: this.timestamp,
    };
  }
}
