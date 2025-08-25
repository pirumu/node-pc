// import { Module } from '@nestjs/common';
//
// import { WsModule } from '../../ws';
//
// import { JobCardController } from './job-card.controller';
// import { JobCardService } from './job-card.service';
// import { JOB_CARD_REPOSITORY_TOKEN } from './repositories';
// import { JobCardImplRepository } from './repositories/impls';
//
// @Module({
//   imports: [WsModule],
//   controllers: [JobCardController],
//   providers: [
//     JobCardService,
//     {
//       provide: JOB_CARD_REPOSITORY_TOKEN,
//       useClass: JobCardImplRepository,
//     },
//   ],
//   exports: [JobCardService],
// })
// export class JobCardModule {}
