import { EVENT_TYPE } from '@common/constants';
import { IAppEvent } from '@common/interfaces';

export class BinClosedEvent implements IAppEvent {
  constructor() {}

  public getChannel(): string {
    return EVENT_TYPE.BIN_CLOSED;
  }

  public getPayload(): Record<string, any> {
    return {};
  }
}
