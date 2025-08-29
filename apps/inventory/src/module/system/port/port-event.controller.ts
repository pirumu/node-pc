import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class PortEventController {
  @EventPattern(EVENT_TYPE.SYSTEM.PORT_DISCOVERING, {})
  public async onPortsDetected(@Payload() payload: { ports: string[] }): Promise<void> {
    console.log(`Port Detected at ${new Date().toISOString()}`, payload);
  }
}
