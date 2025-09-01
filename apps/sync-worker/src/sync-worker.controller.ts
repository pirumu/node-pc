import { Controller, Get } from '@nestjs/common';

import { SyncWorkerService } from './sync-worker.service';

@Controller()
export class SyncWorkerController {
  constructor(private readonly _syncWorkerService: SyncWorkerService) {}

  @Get('sync/users')
  public async syncUsers(): Promise<boolean> {
    return this._syncWorkerService.syncUsers();
  }

  @Get('sync/clusters')
  public async syncClusters(): Promise<boolean> {
    return this._syncWorkerService.syncClusters();
  }

  @Get('sync/cabinets')
  public async syncCabinets(): Promise<boolean> {
    return this._syncWorkerService.syncCabinets();
  }

  @Get('sync/item-types')
  public async syncItemTypes(): Promise<boolean> {
    return this._syncWorkerService.syncItemTypes();
  }

  @Get('sync/items')
  public async syncItems(): Promise<boolean> {
    return this._syncWorkerService.syncItems();
  }

  @Get('sync/areas')
  public async syncAreas(): Promise<boolean> {
    return this._syncWorkerService.syncAreas();
  }

  @Get('sync/conditions')
  public async syncConditions(): Promise<boolean> {
    return this._syncWorkerService.syncConditions();
  }

  @Get('sync/bins')
  public async syncBins(): Promise<boolean> {
    return this._syncWorkerService.syncBins();
  }

  @Get('sync/loadcells')
  public async syncLoadcells(): Promise<boolean> {
    return this._syncWorkerService.syncLoadcells();
  }

  @Get('sync/working-orders')
  public async syncWorkingOrders(): Promise<boolean> {
    return this._syncWorkerService.syncWorkingOrders();
  }
}
