import { Module } from '@nestjs/common';
import { SerialportModule } from '@serialport';

import { ControlUnitLockService } from './control-unit-lock.service';

@Module({
  imports: [SerialportModule],
  providers: [ControlUnitLockService],
  exports: [ControlUnitLockService],
})
export class ControlUnitLockModule {}
