import { ControlUnitLockModule } from '@culock';
import { Module } from '@nestjs/common';

import { CulockController } from './culock.controller';
import { CulockService } from './culock.service';

@Module({
  imports: [ControlUnitLockModule],
  controllers: [CulockController],
  providers: [CulockService],
})
export class CulockModule {}
