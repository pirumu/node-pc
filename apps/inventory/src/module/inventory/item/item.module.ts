import { Module } from '@nestjs/common';

import { CONTROLLERS, REPOSITORY_PROVIDERS, SERVICES_EXPORTS, SERVICES_PROVIDERS } from './item.providers';
import { WsModule } from '../../ws';

@Module({
  imports: [WsModule],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES_PROVIDERS, ...REPOSITORY_PROVIDERS],
  exports: [...SERVICES_EXPORTS],
})
export class ItemModule {}
