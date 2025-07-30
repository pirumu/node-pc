import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { getSocketIoConfig } from '../../config/ws-config';

import { WS_CHANNELS } from './ws.constants';

@WebSocketGateway({
  ...getSocketIoConfig(),
  cors: {
    origin: '*',
  },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly _logger = new Logger(WsGateway.name);

  @WebSocketServer()
  public server: Server;

  constructor() {}

  public handleConnection(client: Socket): void {
    // add authentication
    this._logger.log('New client connected', { sessionId: client.id, headers: client.handshake.headers });
  }

  public handleDisconnect(client: Socket): void {
    this._logger.log('Client disconnected', { sessionId: client.id });
  }

  public sendMessage(channel: WS_CHANNELS, data: Record<string, any>): boolean {
    return this.server.emit(channel, data);
  }

  @SubscribeMessage(WS_CHANNELS.PING)
  public pong(client: Socket): void {
    const lastPongTime = Date.now();
    const payload = { lastPongTime: lastPongTime };
    client.emit(WS_CHANNELS.PONG, payload);
  }

  @SubscribeMessage(WS_CHANNELS.UPDATE_CARD)
  public updateCard(@MessageBody() msg: any): void {}
}
