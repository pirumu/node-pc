import { SwaggerConfig } from '@config/contracts';
import { resolve } from '@config/core';

export const getSwaggerConfig = (): SwaggerConfig => ({
  enabled: resolve('SWAGGER_ENABLED', Boolean, { default: true }),
  title: resolve('SWAGGER_TITLE', String, { default: 'API Docs' }),
  description: resolve('SWAGGER_DESCRIPTION', String, { default: '' }),
  version: resolve('SWAGGER_VERSION', String, { default: '1.0.0' }),
  apiBasePath: resolve('SWAGGER_BASE_PATH', String, { default: '/' }),
  path: resolve('SWAGGER_PATH', String, { default: 'swagger' }),
});
