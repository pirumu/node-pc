import { Module } from '@nestjs/common';
import { SyncWorkerController } from './sync-worker.controller';
import { SyncWorkerService } from './sync-worker.service';

@Module({
  imports: [],
  controllers: [SyncWorkerController],
  providers: [SyncWorkerService],
})
export class SyncWorkerModule {}
