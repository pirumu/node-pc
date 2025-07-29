import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CulockService } from './culock.service';

@Controller()
export class CulockController {
  constructor(private readonly _culockService: CulockService) {}

  @MessagePattern('cu/open')
  public async open(@Payload() cuOpenRequest: any) {
    return this._culockService.open(cuOpenRequest);
  }

  @MessagePattern('cu/status')
  public async status(@Payload() cuOpenRequest: any) {
    return this._culockService.status(cuOpenRequest);
  }

  @MessagePattern('lock/track')
  public async track(@Payload() cuOpenRequest: any) {
    return this._culockService.status(cuOpenRequest);
  }
}
