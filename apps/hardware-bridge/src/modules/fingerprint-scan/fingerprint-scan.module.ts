import { Module } from '@nestjs/common';

import { CONTROLLERS, REPOSITORY_PROVIDERS, SERVICES_EXPORTS, SERVICES_PROVIDERS } from './fingerprint.providers';

@Module({
  controllers: [...CONTROLLERS],
  providers: [...SERVICES_PROVIDERS, ...REPOSITORY_PROVIDERS],
  exports: [...SERVICES_EXPORTS],
})
export class FingerprintModule {}
