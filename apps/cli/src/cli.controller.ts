import { Controller, Get, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { CliService } from './cli.service';

@Controller()
export class CliController {
  constructor(private readonly _cliService: CliService) {}

  @MessagePattern('test_data')
  public getHello(data: unknown): { id: '1' } {
    Logger.log(data, CliController.name);
    return { id: '1' };
  }
}
