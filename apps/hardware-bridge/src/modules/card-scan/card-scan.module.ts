import { Module } from '@nestjs/common';

import { CardScanService } from './card-scan.service';

@Module({
  controllers: [],
  providers: [CardScanService],
})
export class CardScanModule {}
