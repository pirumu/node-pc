import { resolve } from '@config/core';
import { TcpOptions } from '@nestjs/microservices';

export type TcpConfig = { publisher: Required<TcpOptions>['options']; consumer: Required<TcpOptions>['options'] };

export const getTcpConfig = (): TcpConfig => {
  return {
    publisher: {
      host: resolve('PUBLISHER_TCP_HOST', String, { default: '0.0.0.0' }),
      port: resolve(
        'PUBLISHER_TCP_PORT',
        (value) => {
          return parseInt(<string>value, 10);
        },
        { default: 3002 },
      ),
    },
    consumer: {
      host: resolve('CONSUMER_TCP_HOST', String, { default: '0.0.0.0' }),
      port: resolve(
        'CONSUMER_TCP_PORT',
        (value) => {
          return parseInt(<string>value, 10);
        },
        { default: 3002 },
      ),
    },
  };
};
