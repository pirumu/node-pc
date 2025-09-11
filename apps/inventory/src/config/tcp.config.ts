import { resolve } from '@config/core';
import { TcpClientOptions } from '@nestjs/microservices';

export type TcpConfig = { publisher: Required<TcpClientOptions>['options']; consumer?: Required<TcpClientOptions>['options'] };

export const getTcpConfig = (): TcpConfig => {
  return {
    publisher: {
      host: resolve('TCP_PUBLISHER_HOST', String, { default: '127.0.0.1' }),
      port: resolve('TCP_PUBLISHER_PORT', Number, { default: 3002 }),
    },
  };
};
