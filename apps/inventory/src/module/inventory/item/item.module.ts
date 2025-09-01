import { Module } from '@nestjs/common';

import { WsModule } from '../../ws';

import { CONTROLLERS, REPOSITORY_PROVIDERS, SERVICES_EXPORTS, SERVICES_PROVIDERS } from './item.providers';

@Module({
  imports: [WsModule],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES_PROVIDERS, ...REPOSITORY_PROVIDERS],
  exports: [...SERVICES_EXPORTS],
})
export class ItemModule {}
