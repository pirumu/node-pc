import { TRACING_ID } from '@framework/constants';
import { snowflakeId } from '@framework/snowflake';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { MqttContext } from '@nestjs/microservices';

export enum Transport {
  WS = 'ws',
  HTTP = 'http',
  MQTT = 'mqtt',
  TCP = 'tcp',
}
export const TracingID = createParamDecorator<{
  key?: string;
  transport?: Transport;
}>((data = { key: TRACING_ID, transport: Transport.MQTT }, ctx: ExecutionContext) => {
  const { key, transport } = data;

  try {
    switch (transport) {
      case Transport.HTTP: {
        const request = ctx.switchToHttp().getRequest();
        return request.headers[key as string] || snowflakeId.id();
      }

      case Transport.MQTT: {
        const mqttContext = ctx.switchToRpc().getContext<MqttContext>();
        const mqttPacket = mqttContext.getPacket();
        if (mqttPacket && mqttPacket.properties && mqttPacket.properties.userProperties) {
          return mqttPacket.properties.userProperties[key as string];
        }
        return snowflakeId.id();
      }

      case Transport.WS: {
        const wsContext = ctx.switchToWs();
        const data = wsContext.getData();
        if (data && typeof data === 'object') {
          return data[key as string] || snowflakeId.id();
        }
        return snowflakeId.id();
      }

      case Transport.TCP: {
        const data = ctx.switchToRpc().getData();
        if (data && typeof data === 'object' && 'metadata' in data) {
          return data['metadata'][key as string] || snowflakeId.id();
        }
        return snowflakeId.id();
      }
      default: {
        const contextType = ctx.getType();
        if (contextType === 'http') {
          const request = ctx.switchToHttp().getRequest();
          return request.headers[key as string] || snowflakeId.id();
        } else if (contextType === 'ws') {
          const wsContext = ctx.switchToWs();
          const data = wsContext.getData();
          if (data && typeof data === 'object') {
            return data[key as string] || snowflakeId.id();
          }
          return snowflakeId.id();
        } else {
          const mqttContext = ctx.switchToRpc().getContext<MqttContext>();
          const mqttPacket = mqttContext.getPacket();
          if (mqttPacket && mqttPacket.properties && mqttPacket.properties.userProperties) {
            return mqttPacket.properties.userProperties[key as string];
          }
          return snowflakeId.id();
        }
      }
    }
  } catch (_error) {
    return snowflakeId.id();
  }
});

export const HttpTracingID = (key: string = TRACING_ID) => TracingID({ key, transport: Transport.HTTP });

export const MqttTracingID = (key: string = TRACING_ID) => TracingID({ key, transport: Transport.MQTT });

export const WebSocketTracingID = (key: string = TRACING_ID) => TracingID({ key, transport: Transport.WS });

export const AutoTracingID = (key: string = TRACING_ID) => TracingID({ key });
