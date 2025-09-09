import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';

@Controller()
export class BinEventController {
  @EventPattern(EVENT_TYPE.LOCK.TRACKING_STATUS)
  public async track(request: { cuLockId: number; status: any }): Promise<void> {
    console.log(request);
  }
}
