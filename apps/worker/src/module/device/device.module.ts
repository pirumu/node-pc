import { Module } from '@nestjs/common';

import { DeviceWorkerService } from './device.service';
import { DeviceController } from './device.controller';

@Module({
  controllers: [DeviceController],
  providers: [DeviceWorkerService],
})
export class DeviceModule {}
