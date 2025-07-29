import { Module } from '@nestjs/common';

import { MonitoringModule } from './module/monitoring/monitoring.module';
import { NotificationModule } from './module/notification/notification.module';
import { SyncModule } from './module/sync/sync.module';
import { LoadcellsModule } from './module/loadcells/loadcells.module';
import { LockerModule } from './module/locker/locker.module';
import { LockersModule } from './module/lockers/lockers.module';

@Module({
  imports: [SyncModule, MonitoringModule, NotificationModule, LoadcellsModule, LockerModule, LockersModule],
  controllers: [],
  providers: [],
})
export class WorkerModule {}
