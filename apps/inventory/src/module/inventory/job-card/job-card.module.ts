import { Module } from '@nestjs/common';

import { JobCardController } from './job-card.controller';
import { JobCardService } from './job-card.service';
import { JOB_CARD_REPOSITORY_TOKEN } from './repositories';
import { JobCardImplRepository } from './repositories/impls';
import { WsModule } from '../../ws';

@Module({
  imports: [WsModule],
  controllers: [JobCardController],
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
