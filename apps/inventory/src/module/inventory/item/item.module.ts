import { Module } from '@nestjs/common';

import { BinItemModule } from '../bin-item';
import { JobCardModule } from '../job-card';

import { CONTROLLERS, REPOSITORY_PROVIDERS, SERVICES_PROVIDERS } from './item.providers';

@Module({
  imports: [BinItemModule, JobCardModule],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES_PROVIDERS, ...REPOSITORY_PROVIDERS],
  exports: [...SERVICES_PROVIDERS],
})
export class ItemModule {}
