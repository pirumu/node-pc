import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { PortEventService } from './port-event.service';

@Controller()
export class PortEventController {
  constructor(private readonly _portEventService: PortEventService) {}

  @EventPattern(EVENT_TYPE.SYSTEM.PORT_DISCOVERING)
  public async onPortsDetected(@Payload() payload: { ports: { path: string }[] }): Promise<void> {
    return this._portEventService.register((payload?.ports || []).map((p) => p.path));
  }
}
