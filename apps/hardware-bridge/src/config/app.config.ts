import { AppConfig } from '@config/contracts';
import { resolve } from '@config/core';

export const getAppConfig = (): AppConfig => ({
  name: resolve('APP_NAME', String, { default: 'Hardware bridge' }),
  version: process.env.APP_VERSION || '1',
  debug: resolve('APP_DEBUG', (v) => v === 'true', { default: false }),
  port: resolve(
    'APP_PORT',
    (value) => {
      return parseInt(<string>value, 10);
    },
    { default: 3001 },
  ),
  url: resolve('APP_URL', String, { default: 'http://localhost:3001' }),
  env: resolve('APP_ENV', String, { default: 'develop' }),
  apiPrefix: resolve('APP_PREFIX', String, { default: '' }),
  enableCors: resolve('APP_ENABLE_CORS', (v) => v === 'true', {
    default: false,
  }),
  corsOrigin: resolve('APP_CORS_ORIGIN', (v) => (typeof v === 'string' ? v.split(',') : []), {
    default: [],
  }),
  logLevel: resolve(
    'APP_LOG_LEVEL',
    (v) => {
      if (!['debug', 'info', 'warn', 'error'].includes(v as string)) {
        throw new Error('Invalid log level: expect debug, info, warn, error');
      }
      return v as 'debug' | 'info' | 'warn' | 'error';
    },
    { default: 'info' },
  ),
});
