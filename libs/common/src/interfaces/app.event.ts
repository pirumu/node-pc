import { AnyEventType } from '@common/constants';

export interface IAppEvent {
  getChannel(...args: any[]): AnyEventType;
  getPayload(...args: any[]): any;
}
