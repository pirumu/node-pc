import { CloudConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { SyncWorkerService } from './sync-worker.service';

export class SyncDto {
  @ApiProperty()
  @Type(() => String)
  @Expose()
  host: string;

  @ApiProperty()
  @Type(() => String)
  @Expose()
  accessKey: string;

  @ApiProperty()
  @Type(() => String)
  @Expose()
  clusterId: string;
}

@Controller()
export class SyncWorkerController {
  constructor(
    private readonly _configService: ConfigService,
    private readonly _syncWorkerService: SyncWorkerService,
  ) {}

  @Post('sync/all')
  public async syncAll(@Body() body: SyncDto): Promise<true> {
    this._configService.set<CloudConfig>(CONFIG_KEY.CLOUD, {
      siteAccessKey: body.accessKey,
      host: body.host,
    });
    await this._syncWorkerService.syncClusters();
    await this._syncWorkerService.syncWorkingOrders();
    await this._syncWorkerService.syncConditions();
    await this._syncWorkerService.syncItemTypes();
    await this._syncWorkerService.syncItems();
    await this._syncWorkerService.syncCabinets();
    await this._syncWorkerService.syncClusters(body.clusterId);
    await this._syncWorkerService.syncBins();
    await this._syncWorkerService.syncLoadcells();
    await this._syncWorkerService.syncAreas();
    await this._syncWorkerService.syncUsers();
    return true;
  }

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

  @Get('sync/loadcells')
  public async syncLoadcells(): Promise<boolean> {
    return this._syncWorkerService.syncLoadcells();
  }

  @Get('sync/bins')
  public async syncBins(): Promise<boolean> {
    return this._syncWorkerService.syncBins();
  }

  @Get('sync/working-orders')
  public async syncWorkingOrders(): Promise<boolean> {
    return this._syncWorkerService.syncWorkingOrders();
  }
}
