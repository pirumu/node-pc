import { Module } from '@nestjs/common';

import { TransactionController, QuantityCheckingController } from './controllers';
import { TransactionService, QuantityCheckingService } from './services';

@Module({
  controllers: [TransactionController, QuantityCheckingController],
  providers: [TransactionService, QuantityCheckingService],
})
export class TransactionModule {}
