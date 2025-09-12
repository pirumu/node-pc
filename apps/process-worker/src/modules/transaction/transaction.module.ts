import { Module } from '@nestjs/common';

import { LoadcellModule } from '../loadcell';

import { TransactionController, QuantityCheckingController } from './controllers';
import { TransactionService, QuantityCheckingService } from './services';

@Module({
  imports: [LoadcellModule],
  controllers: [TransactionController, QuantityCheckingController],
  providers: [TransactionService, QuantityCheckingService],
})
export class TransactionModule {}
