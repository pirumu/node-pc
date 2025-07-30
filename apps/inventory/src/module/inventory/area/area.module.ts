import { MongoDALModule } from '@dals/mongo';
import { Module } from '@nestjs/common';

import { CONTROLLERS, REPOSITORY_PROVIDERS, SERVICES_EXPORTS, SERVICES_PROVIDERS } from './area.providers';

@Module({
  imports: [MongoDALModule],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES_PROVIDERS, ...REPOSITORY_PROVIDERS],
  exports: [...SERVICES_EXPORTS],
})
export class AreaModule {}
