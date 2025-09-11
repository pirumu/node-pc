import { resolve } from '@config/core';
import { TcpOptions } from '@nestjs/microservices';

export type TcpConfig = { publisher: Required<TcpOptions>['options']; consumer: Required<TcpOptions>['options'] };

export const getTcpConfig = (): TcpConfig => {
  return {
    publisher: {
      host: resolve('TCP_PUBLISHER_HOST', String, { default: '127.0.0.1' }),
      port: resolve(
        'TCP_PUBLISHER_PORT',
        (value) => {
          return parseInt(<string>value, 10);
        },
        { default: 3002 },
      ),
    },
    consumer: {
      host: resolve('TCP_CONSUMER_HOST', String, { default: '127.0.0.1' }),
      port: resolve(
        'TCP_CONSUMER_PORT',
        (value) => {
          return parseInt(<string>value, 10);
        },
        { default: 3002 },
      ),
    },
  };
};
