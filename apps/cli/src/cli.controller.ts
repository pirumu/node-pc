import { Controller, Get, Logger } from '@nestjs/common';
import { CliService } from './cli.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class CliController {
  constructor(private readonly _cliService: CliService) {}

  @MessagePattern('test_data')
  public getHello(data: unknown): { id: '1' } {
    Logger.log(data, CliController.name);
    return { id: '1' };
  }
}
