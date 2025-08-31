import { PublisherService, Transport } from '@framework/publisher';
import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { getSocketIoConfig } from '../../config/ws-config';

import { WS_CHANNELS } from './ws.constants';
import { EVENT_TYPE } from '@common/constants';

@WebSocketGateway({
  ...getSocketIoConfig(),
  cors: {
    origin: '*',
  },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly _logger = new Logger(WsGateway.name);
  constructor(private readonly _publisherService: PublisherService) {}

  @WebSocketServer()
  public server: Server;

  public handleConnection(client: Socket): void {
    // add authentication
    this._logger.log('New client connected', { sessionId: client.id, headers: client.handshake.headers });
  }

  public handleDisconnect(client: Socket): void {
    this._logger.log('Client disconnected', { sessionId: client.id });
    if (client.data.room?.includes('loadcell_')) {
      const room = client.data.room;
      const m = room.split('_');
      if (m[1] && m[1] !== '0') {
        this._publisherService.publish(
          Transport.MQTT,
          EVENT_TYPE.LOADCELL.STOP_READING,
          { hardwareIds: [parseInt(m[1])] },
          {},
          { async: true },
        );
      }
    }
  }

  public sendMessage(channel: WS_CHANNELS, data: Record<string, any>): boolean {
    return this.server.emit(channel, data);
  }

  public sendTo(channel: WS_CHANNELS, data: Record<string, any>, to: string[]): boolean {
    return this.server.to(to).emit(channel, data);
  }

  public async leave(rooms: string[]): Promise<void> {
    const socketClient = await this.server.fetchSockets();
    socketClient.forEach((socket) => {
      rooms.forEach((room) => socket.leave(room));
    });
  }

  @SubscribeMessage(WS_CHANNELS.PING)
  public pong(client: Socket): void {
    const lastPongTime = Date.now();
    const payload = { lastPongTime: lastPongTime };
    client.emit(WS_CHANNELS.PONG, payload);
  }

  @SubscribeMessage(WS_CHANNELS.UPDATE_CARD)
  public updateCard(@MessageBody() msg: any): void {}

  @SubscribeMessage(WS_CHANNELS.REQUEST_SCAN_EMPLOYEE)
  public joinCluster(@ConnectedSocket() client: Socket, @MessageBody() msg: { clusterId?: string; clientId?: string }): void {
    if (msg.clusterId) {
      client.join(msg.clusterId);
    }
  }

  @SubscribeMessage(WS_CHANNELS.JOIN)
  public joinRoom(@ConnectedSocket() client: Socket, @MessageBody() msg: { room: string }): void {
    if (msg.room) {
      client.join(msg.room);
      client.data = { room: msg.room };
      const m = msg.room.split('_');
      if (m[1] && m[1] !== '0') {
        this._publisherService.publish(
          Transport.MQTT,
          EVENT_TYPE.LOADCELL.START_READING,
          { hardwareIds: [parseInt(m[1])] },
          {},
          { async: true },
        );
      }
    }
  }

  @SubscribeMessage(WS_CHANNELS.LEAVE)
  public async leaveRoom(@ConnectedSocket() client: Socket, @MessageBody() msg: { room: string }): Promise<any> {
    if (msg.room) {
      client.leave(msg.room);
      if (msg.room.includes('loadcell_')) {
        const m = msg.room.split('_');
        if (m[1] && m[1] !== '0') {
          return this._publisherService.publish(
            Transport.MQTT,
            EVENT_TYPE.LOADCELL.STOP_READING,
            { hardwareIds: [parseInt(m[1])] },
            {},
            { async: true },
          );
        }
      }
    }
  }
}
