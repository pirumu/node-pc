import { Global, Module } from '@nestjs/common';
import { SerialportModule } from '@serialport';

import { LoadcellsHealthMonitoringService } from './loadcells-monitoring.service';
import { LoadcellsService } from './loadcells.service';

@Module({
  imports: [SerialportModule],
  providers: [LoadcellsService, LoadcellsHealthMonitoringService],
  exports: [LoadcellsService, LoadcellsHealthMonitoringService],
})
export class LoadcellsModule {}
