import { Controller, Get } from '@nestjs/common';

import { SyncWorkerService } from './sync-worker.service';

@Controller()
export class SyncWorkerController {
  constructor(private readonly _syncWorkerService: SyncWorkerService) {}

  @Get('sync/users')
  public async syncUsers(): Promise<boolean> {
    return this._syncWorkerService.syncUsers();
  }
}
