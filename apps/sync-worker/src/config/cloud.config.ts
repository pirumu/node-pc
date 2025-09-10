import { CloudConfig } from '@config/contracts';
import { resolve } from '@config/core';

export const getCloudConfig = (): CloudConfig => ({
  host: resolve('CLOUD_SERVICE_HOST', String, { default: '' }),
  siteAccessKey: resolve('CLOUD_SERVICE_SITE_ACCESS_KEY', String, { default: '' }),
});
