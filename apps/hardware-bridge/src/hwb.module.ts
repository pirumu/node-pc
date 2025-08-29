import { AppConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
// import { DEFAULT_CONFIG, FingerprintScanModule } from '@fingerprint-scanner';
import { TRACING_ID } from '@framework/constants';
import { AppLoggerModule } from '@framework/logger';
import { PublisherModule } from '@framework/publisher';
import { snowflakeId } from '@framework/snowflake';
import { HidDeviceModule } from '@hid';
import { LoadcellsModule } from '@loadcells';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SerialportModule, SerialportModuleConfig } from '@serialport';
import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

import { configs } from './config';
// import { FingerprintConfig } from './config/fingerprint.config';
import { MqttConfig } from './config/mqtt.config';
import { HARDWARE_MODULES } from './modules';
// import { FingerprintModule } from './modules/fingerprint';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configs],
      isGlobal: true,
      cache: true,
    }),
    // FingerprintScanModule.forRootAsync({
    //   useFactory: (configService: ConfigService) => {
    //     const config = configService.getOrThrow<FingerprintConfig>(CONFIG_KEY.FINGERPRINT);
    //     return {
    //       ...DEFAULT_CONFIG,
    //       binaryPath: path.join(process.cwd(), config.binaryPath),
    //       devicePort: config.defaultPort,
    //       maxCommandAge: 30000, // 30s
    //       logLevel: 'debug',
    //     };
    //   },
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    // }),
    // FingerprintModule,

    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: Request) => {
          return (req.headers[TRACING_ID] as string) ?? snowflakeId.id();
        },
      },
    }),
    AppLoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEY.APP);
        return {
          env: appConfig.env,
          logLevel: appConfig.logLevel || 'info',
          enableCorrelation: true,
        };
      },
      inject: [ConfigService],
    }),
    PublisherModule.forRootAsync({
      global: true,
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<MqttConfig>(CONFIG_KEY.MQTT);
        return {
          mqtt: {
            options: config.publisher,
            enabled: true,
          },
        };
      },
      inject: [ConfigService],
    }),
    SerialportModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        return configService.getOrThrow<SerialportModuleConfig>(CONFIG_KEY.SERIALPORT);
      },
      inject: [ConfigService],
    }),
    LoadcellsModule.forRootAsync({
      useFactory: () => {
        return {
          loadCellConfig: {
            enabled: true,
            logLevel: 1,
            pollingInterval: 1500,
          },
          healthMonitoringConfig: {
            enabled: true,
            heartbeatTimeout: 10000,
            logConnectionChanges: true,
            checkInterval: 5000,
          },
        };
      },
      inject: [ConfigService],
    }),
    ...HARDWARE_MODULES,
    HidDeviceModule,
  ],
  controllers: [],
  providers: [],
})
export class HwbModule {}
