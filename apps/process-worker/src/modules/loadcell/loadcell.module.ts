import { Module } from '@nestjs/common';

import { LoadcellController } from './loadcell.controller';
import { LoadcellService } from './loadcell.service';

@Module({
  controllers: [LoadcellController],
  providers: [LoadcellService],
})
export class LoadcellModule {}
