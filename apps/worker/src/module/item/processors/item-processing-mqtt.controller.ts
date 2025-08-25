// import { PROCESS_ITEM_TYPE } from '@common/constants';
// import { TracingID } from '@framework/decorators';
// import { Controller, Logger } from '@nestjs/common';
// import { EventPattern, Payload } from '@nestjs/microservices';
//
// import { CalculationService } from './calculation.service';
//
// @Controller()
// export class ItemProcessingMqttController {
//   private readonly _logger = new Logger(ItemProcessingMqttController.name);
//
//   constructor(private readonly _calculationService: CalculationService) {}
//
//   @EventPattern('lock/openSuccess')
//   public async onLockOpenSuccess(
//     @TracingID() tracingId: string,
//     @Payload()
//     payload: {
//       type: PROCESS_ITEM_TYPE;
//       data: any;
//       transactionId: string;
//     },
//   ): Promise<void> {
//     this._logger.log('[onLockOpenSuccess]', {
//       tracingId,
//       payload,
//     });
//     const result = await this._calculationService.onLockOpenSuccess({
//       transactionId: payload.transactionId,
//       transactionType: payload.type,
//       data: payload.data,
//     });
//     this._logger.debug('Complete', result);
//   }
// }
