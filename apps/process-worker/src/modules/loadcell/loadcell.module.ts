import { Module } from '@nestjs/common';

import { BatchLoadcellService } from './batch-loadcell.service';
import { LoadcellController } from './loadcell.controller';

@Module({
  controllers: [LoadcellController],
  providers: [BatchLoadcellService],
  exports: [BatchLoadcellService],
})
export class LoadcellModule {}
