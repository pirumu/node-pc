import { EVENT_TYPE } from '@common/constants';
import { PublisherService, Transport } from '@framework/publisher';
import { sleep } from '@framework/time/sleep';
import { EntityManager } from '@mikro-orm/mongodb';
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';

import { TransactionService } from '../services';

@Controller()
export class TransactionController {
  constructor(
    private readonly _em: EntityManager,
    private readonly _transactionService: TransactionService,
    private readonly _publisherService: PublisherService,
  ) {}

  @EventPattern(EVENT_TYPE.PROCESS.START)
  public async start(payload: { transactionId: string }): Promise<any> {
    return this._transactionService.process(payload.transactionId);
  }

  @EventPattern(EVENT_TYPE.PROCESS.FORCE_NEXT_STEP)
  public async nextStep(payload: { transactionId: string; isNextRequestItem: boolean }): Promise<void> {
    return this._transactionService.forceNextStep(this._em.fork(), payload.transactionId, payload.isNextRequestItem);
  }

  @EventPattern(EVENT_TYPE.PROCESS.STEP_SUCCESS)
  public async onStepSuccess(payload: { transactionId: string; stepId: string }): Promise<void> {
    return this._transactionService.handleStepSuccess(this._em.fork(), payload);
  }

  @EventPattern(EVENT_TYPE.PROCESS.STEP_ERROR)
  public async onStepError(payload: { transactionId: string; stepId: string; errors: string[] }): Promise<void> {
    return this._transactionService.handleStepFail(this._em.fork(), payload);
  }

  @EventPattern(EVENT_TYPE.PROCESS.TRANSACTION_COMPLETED)
  public async onTxComplete(payload: { transactionId: string }): Promise<void> {
    await sleep(1000);
    return this._transactionService.handleTxComplete(this._em.fork(), payload);
  }

  @EventPattern(EVENT_TYPE.PROCESS.TRANSACTION_FAILED)
  public async onTxFailed(payload: { transactionId: string }): Promise<void> {
    return this._transactionService.handleTxError(this._em.fork(), payload);
  }
}
