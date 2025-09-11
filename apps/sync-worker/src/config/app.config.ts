import { AppConfig } from '@config/contracts';
import { resolve } from '@config/core';

export const getAppConfig = (): AppConfig => ({
  name: resolve('APP_NAME', String, { default: 'Sync Worker' }),
  version: process.env.APP_VERSION || '1',
  debug: resolve('APP_DEBUG', (v) => v === 'true', { default: false }),
  port: resolve(
    'APP_PORT',
    (value) => {
      return parseInt(<string>value, 10);
    },
    { default: 3005 },
  ),
  url: resolve('APP_URL', String, { default: 'http://localhost:3005' }),
  env: resolve('APP_ENV', String, { default: 'develop' }),
  apiPrefix: '',
  logLevel: resolve(
    'APP_LOG_LEVEL',
    (v) => {
      if (!['debug', 'info', 'warn', 'error'].includes(v as string)) {
        throw new Error('Invalid log level: expect debug, info, warn, error');
      }
      return v as 'debug' | 'info' | 'warn' | 'error';
    },
    { default: 'debug' },
  ),
});
