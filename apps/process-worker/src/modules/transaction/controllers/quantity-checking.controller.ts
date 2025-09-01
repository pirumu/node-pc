import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';

import { QuantityCheckingService } from '../services';

@Controller()
export class QuantityCheckingController {
  constructor(private readonly _quantityCheckingService: QuantityCheckingService) {}

  @EventPattern(EVENT_TYPE.BIN.OPENED)
  public async onBinOpened(payload: { transactionId: string; binId: string }): Promise<void> {
    if (!payload.transactionId) {
      return;
    }
    return this._quantityCheckingService.handleBinOpened(payload);
  }

  @EventPattern(EVENT_TYPE.BIN.CLOSED)
  public async onBinClosed(payload: { transactionId: string; binId: string }): Promise<void> {
    if (!payload.transactionId) {
      return;
    }
    return this._quantityCheckingService.handleBinClosed(payload);
  }
}
