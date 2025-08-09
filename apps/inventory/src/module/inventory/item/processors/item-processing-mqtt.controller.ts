import { TracingID } from '@framework/decorators';
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { ChangeProcessStatusPayload, NotifyBinOpenErrorPayload, NotifyProcessErrorPayload, ProcessItemPayload } from '../dtos/processor';

import { CalculationService } from './calculation.service';
import { ItemProcessingService } from './item-processing.service';

@Controller()
export class ItemProcessingMqttController {
  private readonly _logger = new Logger(ItemProcessingMqttController.name);

  constructor(
    private readonly _calculationService: CalculationService,
    private readonly _itemProcessingService: ItemProcessingService,
  ) {}

  @EventPattern('bin/openFail')
  public async onBinOpenFail(@TracingID() tracingId: string, @Payload() payload: NotifyBinOpenErrorPayload): Promise<void> {
    this._logger.debug('[onBinOpenFail]', {
      tracingId,
      payload,
    });
    const { transactionId, binId } = payload;
    return this._itemProcessingService.handleBinOpenFail(transactionId, binId);
  }

  @EventPattern('process-item/status')
  public async onProcessStatusChange(@TracingID() tracingId: string, @Payload() payload: ChangeProcessStatusPayload): Promise<void> {
    this._logger.debug('[onProcessStatusChange]', {
      tracingId,
      payload,
    });
    const { transactionId, ...newState } = payload;
    return this._itemProcessingService.updateProcessStatus(transactionId, newState);
  }

  @EventPattern('process-item/error')
  public async onProcessError(@TracingID() tracingId: string, @Payload() payload: NotifyProcessErrorPayload): Promise<void> {
    this._logger.debug('[onProcessError]', {
      tracingId,
      payload,
    });

    const { transactionId, ...newState } = payload;
    return this._itemProcessingService.updateProcessError(transactionId, newState);
  }

  @EventPattern('lock/openSuccess')
  public async onLockOpenSuccess(@TracingID() tracingId: string, @Payload() payload: ProcessItemPayload): Promise<void> {
    this._logger.debug('[onLockOpenSuccess]', {
      tracingId,
      payload,
    });
    const result = await this._calculationService.onLockOpenSuccess(payload);
    this._logger.debug('Complete', result);
  }
}
