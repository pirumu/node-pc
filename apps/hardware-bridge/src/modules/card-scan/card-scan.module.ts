import { HidDeviceModule } from '@hid';
import { Module } from '@nestjs/common';

import { CardScanService } from './card-scan.service';

@Module({
  imports: [HidDeviceModule],
  controllers: [],
  providers: [CardScanService],
})
export class CardScanModule {}
