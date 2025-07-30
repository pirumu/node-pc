import { DynamicModule, Module, Provider } from '@nestjs/common';

import { SerialPortAdapter } from './serial/impl';
import { SERIAL_PORT_MANAGER } from './serial/serial.constants';
import { DISCOVERY_CONFIG, MONITORING_CONFIG, SERIALPORT_MODULE_CONFIG } from './serialport.constants';
import { PortDiscoveryService, DiscoveryConfig } from './services/port-discovery.service';
import { PortMonitoringService, MonitoringConfig } from './services/port-monitoring.service';

export type SerialportModuleConfig = {
  discovery?: Partial<DiscoveryConfig>;
  monitoring?: Partial<MonitoringConfig>;
};

export type SerialportModuleAsyncOptions = {
  inject?: any[];
  useFactory?: (...args: any[]) => Promise<SerialportModuleConfig> | SerialportModuleConfig;
  useClass?: new (...args: any[]) => SerialportModuleConfig;
  useExisting?: any;
};

@Module({})
export class SerialportModule {
  public static forRootAsync(options: SerialportModuleAsyncOptions): DynamicModule {
    const configProvider = this._createConfigProvider(options);
    const discoveryConfigProvider = this._createDiscoveryConfigProvider();
    const monitoringConfigProvider = this._createMonitoringConfigProvider();

    return {
      global: true,
      module: SerialportModule,
      providers: [
        configProvider,
        discoveryConfigProvider,
        monitoringConfigProvider,
        {
          provide: SERIAL_PORT_MANAGER,
          useClass: SerialPortAdapter,
        },
        PortDiscoveryService,
        PortMonitoringService,
      ],
      exports: [PortDiscoveryService, PortMonitoringService, SERIAL_PORT_MANAGER],
    };
  }

  private static _createConfigProvider(options: SerialportModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: SERIALPORT_MODULE_CONFIG,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    if (options.useClass) {
      return {
        provide: SERIALPORT_MODULE_CONFIG,
        useClass: options.useClass,
      };
    }

    if (options.useExisting) {
      return {
        provide: SERIALPORT_MODULE_CONFIG,
        useExisting: options.useExisting,
      };
    }

    return {
      provide: SERIALPORT_MODULE_CONFIG,
      useValue: {},
    };
  }

  private static _createDiscoveryConfigProvider(): Provider {
    return {
      provide: DISCOVERY_CONFIG,
      useFactory: (config: SerialportModuleConfig): DiscoveryConfig => {
        const defaultDiscoveryConfig: DiscoveryConfig = {
          enabled: true,
          scanInterval: 5000,
          autoConnect: true,
          includeSystemPorts: false,
          excludePaths: [],
          includeManufacturers: [],
          excludeManufacturers: [],
          serialOptions: {
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            autoOpen: true,
          },
        };

        return {
          ...defaultDiscoveryConfig,
          ...config.discovery,
        };
      },
      inject: [SERIALPORT_MODULE_CONFIG],
    };
  }

  private static _createMonitoringConfigProvider(): Provider {
    return {
      provide: MONITORING_CONFIG,
      useFactory: (config: SerialportModuleConfig): MonitoringConfig => {
        const defaultMonitoringConfig: MonitoringConfig = {
          enabled: true,
          connectionCheckInterval: 2000,
          healthCheckInterval: 10000,
          discoveryRefreshInterval: 5000,
          maxIdleTime: 60000,
          enableEventLogging: true,
        };

        return {
          ...defaultMonitoringConfig,
          ...config.monitoring,
        };
      },
      inject: [SERIALPORT_MODULE_CONFIG],
    };
  }
}
