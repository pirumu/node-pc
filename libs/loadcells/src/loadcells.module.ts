import { DynamicModule, Module, Provider } from '@nestjs/common';
import { SerialportModule } from '@serialport';

import { LoadcellsHealthMonitoringService } from './loadcells-monitoring.service';
import { LOADCELLS_HEALTH_MONITORING_CONFIG, LOADCELLS_MODULE_CONFIG_OPTIONS, LOADCELLS_SERVICE_CONFIG } from './loadcells.contants';
import { LoadcellsService } from './loadcells.service';
import { HealthMonitoringConfig, LoadCellConfig, LoadcellsModuleAsyncOptions, LoadcellsModuleOptions } from './loadcells.types';

@Module({})
export class LoadcellsModule {
  private static readonly _defaultLoadCellConfig: LoadCellConfig = {
    enabled: true,
    logLevel: 0,
    precision: 100,
    initTimer: 500,
    charStart: 0x55,
    messageLength: 11,
    discoveryTimeout: 10000,
    serialOptions: {
      baudRate: 9600,
      autoOpen: false,
      parser: { type: 'bytelength', options: { length: 11 } },
    },
    pollingInterval: 1000,
  };

  private static readonly _defaultHealthMonitoringConfig: HealthMonitoringConfig = {
    enabled: false,
    checkInterval: 5000,
    heartbeatTimeout: 10000,
    logConnectionChanges: true,
  };

  public static forRootAsync(options: LoadcellsModuleAsyncOptions): DynamicModule {
    const providers = this._createAsyncProviders(options);

    return {
      global: true,
      module: LoadcellsModule,
      imports: [SerialportModule, ...(options.imports || [])],
      providers: [...providers, LoadcellsService, LoadcellsHealthMonitoringService],
      exports: [
        LOADCELLS_MODULE_CONFIG_OPTIONS,
        LOADCELLS_SERVICE_CONFIG,
        LOADCELLS_HEALTH_MONITORING_CONFIG,
        LoadcellsService,
        LoadcellsHealthMonitoringService,
      ],
    };
  }

  private static _createAsyncProviders(options: LoadcellsModuleAsyncOptions): Provider[] {
    return [
      {
        provide: LOADCELLS_MODULE_CONFIG_OPTIONS,
        useFactory: options.useFactory as any,
        inject: options.inject || [],
      },
      {
        provide: LOADCELLS_SERVICE_CONFIG,
        useFactory: (moduleOptions: LoadcellsModuleOptions) => ({
          ...this._defaultLoadCellConfig,
          ...moduleOptions.loadCellConfig,
          serialOptions: {
            ...this._defaultLoadCellConfig.serialOptions,
            ...moduleOptions.loadCellConfig?.serialOptions,
          },
        }),
        inject: [LOADCELLS_MODULE_CONFIG_OPTIONS],
      },
      {
        provide: LOADCELLS_HEALTH_MONITORING_CONFIG,
        useFactory: (moduleOptions: LoadcellsModuleOptions) => ({
          ...this._defaultHealthMonitoringConfig,
          ...moduleOptions.healthMonitoringConfig,
        }),
        inject: [LOADCELLS_MODULE_CONFIG_OPTIONS],
      },
    ];
  }
}
