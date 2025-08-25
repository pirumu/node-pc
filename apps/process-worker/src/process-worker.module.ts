import { Module } from '@nestjs/common';

import { LoadcellModule } from './modules/loadcell';
import { TransactionModule } from './modules/transaction/transaction.module';

@Module({
  imports: [LoadcellModule, TransactionModule],
  controllers: [],
  providers: [],
})
export class ProcessWorkerModule {}
