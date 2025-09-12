import { Module } from '@nestjs/common';
import { SerialportModule } from '@serialport';

import { ControlUnitLockWithMutexService } from './control-unit-lock-with-mutex.service';

@Module({
  imports: [SerialportModule],
  providers: [ControlUnitLockWithMutexService],
  exports: [ControlUnitLockWithMutexService],
})
export class ControlUnitLockModule {}
