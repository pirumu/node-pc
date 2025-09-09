import { Module } from '@nestjs/common';

import { TransactionEventStreamService } from './transaction-event-stream.service';
import { TransactionStreamService } from './transaction-stream.service';

@Module({
  providers: [TransactionStreamService, TransactionEventStreamService],
})
export class LocalToCloudModule {}
