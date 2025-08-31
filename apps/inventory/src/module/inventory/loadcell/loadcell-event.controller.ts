import { WeightCalculatedEvent } from '@common/business/events';
import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { WsGateway } from '../../ws';

@Controller()
export class LoadCellEventController {
  constructor(private readonly _wsGateway: WsGateway) {}
  @EventPattern(EVENT_TYPE.LOADCELL.WEIGHT_CALCULATED)
  public async onWeighCalculated(@Payload() event: WeightCalculatedEvent): Promise<any> {
    this._wsGateway.sendTo(`raw_data` as any, event, [`loadcell_${event.hardwareId.toString()}`]);
  }
}
