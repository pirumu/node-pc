import { Module } from '@nestjs/common';

import { JobCardService } from './job-card.service';
import { JOB_CARD_REPOSITORY_TOKEN } from './repositories';
import { JobCardImplRepository } from './repositories/impls';

@Module({
  imports: [],
  providers: [
    JobCardService,
    {
      provide: JOB_CARD_REPOSITORY_TOKEN,
      useClass: JobCardImplRepository,
    },
  ],
  exports: [JobCardService],
})
export class JobCardModule {}
