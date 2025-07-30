import { ControlUnitLockModule } from '@culock';
import { Module } from '@nestjs/common';

import { CulockController } from './culock.controller';
import { CulockService } from './culock.service';
import { LockMonitoringService } from './lock-tracking.service';

@Module({
  imports: [ControlUnitLockModule],
  controllers: [CulockController],
  providers: [CulockService, LockMonitoringService],
})
export class CulockModule {}
