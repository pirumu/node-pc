import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { TransactionService } from './transaction.service';

@Controller()
export class TransactionMqttController {
  constructor(private readonly _transactionService: TransactionService) {}

  @MessagePattern({ cmd: 'lock/openSuccess' })
  public onLockOpenSuccess(@Payload() msg: any): void {
    return this._transactionService.handleLockOpenSuccess(msg);
  }
}
