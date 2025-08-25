import { Controller, Get } from '@nestjs/common';
import { SyncWorkerService } from './sync-worker.service';

@Controller()
export class SyncWorkerController {
  constructor(private readonly syncWorkerService: SyncWorkerService) {}

  @Get()
  getHello(): string {
    return this.syncWorkerService.getHello();
  }
}
