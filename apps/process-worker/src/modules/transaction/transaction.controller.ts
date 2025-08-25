import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { TransactionService } from './transaction.service';

@Controller()
export class TransactionController {
  constructor(private readonly _transactionService: TransactionService) {}

  @EventPattern(EVENT_TYPE.BIN.OPENED)
  public async onOpenedBin(@Payload() payload: any): Promise<void> {}

  @EventPattern(EVENT_TYPE.BIN.OPENED)
  public async onClosedBin(@Payload() payload: any): Promise<void> {}
}
