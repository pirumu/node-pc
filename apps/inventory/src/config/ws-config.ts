import { resolve } from '@config/core';
import { WSConfig } from '@config/contracts';

export const getSocketIoConfig = (): WSConfig => ({
  path: resolve('WS_PATH', String, { require: true }),
  transports: resolve('WS_TRANSPORTS', String, { default: 'polling' }).split(','),
  pingInterval: resolve('WS_PING_INTERVAL', Number, { default: 3000 }),
  pingTimeout: resolve('WS_PING_TIMEOUT', Number, { default: 3000 }),
});
