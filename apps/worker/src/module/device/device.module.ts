import { Module } from '@nestjs/common';

import { DeviceController } from './device.controller';
import { DeviceWorkerService } from './device.service';

@Module({
  controllers: [DeviceController],
  providers: [DeviceWorkerService],
})
export class DeviceModule {}
