import { Module } from '@nestjs/common';

import { CONTROLLERS, SERVICES_EXPORTS, REPOSITORY_PROVIDERS, SERVICES_PROVIDERS } from './tablet.provides';

@Module({
  imports: [],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES_PROVIDERS, ...REPOSITORY_PROVIDERS],
  exports: [...SERVICES_EXPORTS],
})
export class TabletModule {}
