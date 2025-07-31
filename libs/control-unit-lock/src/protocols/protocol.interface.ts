import { Command, ProtocolType } from './protocol.constants';

export type MessageOptions = {
  command: Command;
  deviceId: number;
  lockId?: number;
  timeout?: number;
};

export type MessagesOptions = {
  command: Command;
  deviceId: number;
  lockIds: number[];
  timeout?: number;
};

export type BaseResponse = {
  deviceId: number;
  isSuccess: boolean;
};

export interface IProtocol<R> {
  createMessage(options: MessageOptions): Buffer;
  createMessages(options: MessagesOptions): Buffer[];
  parseResponse(deviceId: number, lockIds: number[], data: Buffer): R;
  getProtocolType(): ProtocolType;
}
