import { WeightCalculatedEvent } from '@common/business/events';
import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { BatchLoadcellService } from './batch-loadcell.service';

@Controller()
export class LoadcellController {
  constructor(private readonly _loadcellService: BatchLoadcellService) {}

  @EventPattern(EVENT_TYPE.LOADCELL.WEIGHT_CALCULATED)
  public async onWeighCalculated(@Payload() event: WeightCalculatedEvent): Promise<any> {
    return this._loadcellService.onWeighCalculated([event]);
  }
}
