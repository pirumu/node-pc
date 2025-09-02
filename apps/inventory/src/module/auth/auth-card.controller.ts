import { EVENT_TYPE } from '@common/constants';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { WsGateway } from '../ws';

import { AuthService } from './services';

@Controller()
export class AuthCardController {
  constructor(
    private readonly _authService: AuthService,
    private readonly _wsGateway: WsGateway,
  ) {}

  @EventPattern(EVENT_TYPE.CARD.SCANNED)
  public async onCardScanned(@Payload() payload: { value: string }): Promise<void> {
    try {
      const responses = await this._authService.loginByCard(payload.value);
      responses.forEach((res) => {
        if (res[0] === 'none') {
          this._wsGateway.sendMessage('scan-employee' as any, { success: true, data: res[1] });
        } else {
          this._wsGateway.sendTo('scan-employee' as any, { success: true, data: res[1] }, [res[0]]);
        }
      });
    } catch (err) {
      this._wsGateway.sendMessage('scan-employee' as any, { success: false, data: null });

      throw err;
    }
  }
}
