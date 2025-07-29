import { Module } from '@nestjs/common';

import { HidService } from './hid.service';

@Module({
  imports: [],
  providers: [HidService],
  exports: [HidService],
})
export class HidDeviceModule {}
