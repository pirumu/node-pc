import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { TransactionService } from '../services';

@Controller()
export class TransactionController {
  constructor(private readonly _transactionService: TransactionService) {}

  @EventPattern(EVENT_TYPE.PROCESS.START)
  public async start(@Payload() payload: { transactionId: string }): Promise<void> {
    return this._transactionService.process(payload.transactionId);
  }

  @EventPattern(EVENT_TYPE.PROCESS.FORCE_NEXT_STEP)
  public async nextStep(@Payload() payload: { transactionId: string }): Promise<void> {
    return this._transactionService.forceNextStep(payload.transactionId);
  }

  @EventPattern(EVENT_TYPE.PROCESS.STEP_SUCCESS)
  public async onStepSuccess(@Payload() payload: { transactionId: string; stepId: string }): Promise<void> {
    return this._transactionService.handleStepSuccess(payload);
  }

  @EventPattern(EVENT_TYPE.PROCESS.STEP_SUCCESS)
  public async onStepError(@Payload() payload: { transactionId: string; stepId: string; errors: string[] }): Promise<void> {
    return this._transactionService.handleStepFail(payload);
  }
}
