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
  isValid: boolean;
  deviceId: number;
  isSuccess: boolean;
  raw: string;
};

export interface IProtocol<R> {
  createMessage(options: MessageOptions): Buffer;
  createMessages(options: MessagesOptions): Buffer[];
  parseResponse(data: Buffer): R;
  getProtocolType(): ProtocolType;
}
