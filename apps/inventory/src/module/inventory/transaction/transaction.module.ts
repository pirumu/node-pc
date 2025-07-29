import { Module } from '@nestjs/common';

import { TransactionMqttController } from './transaction-mqtt.controller';
import { TransactionService } from './transaction.service';

@Module({
  controllers: [TransactionMqttController],
  providers: [TransactionService],
})
export class TransactionModule {}
