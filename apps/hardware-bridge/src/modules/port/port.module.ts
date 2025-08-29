import { Module } from '@nestjs/common';

import { PortDetectionService } from './port-detection.service';

@Module({
  imports: [],
  providers: [PortDetectionService],
})
export class PortModule {}
