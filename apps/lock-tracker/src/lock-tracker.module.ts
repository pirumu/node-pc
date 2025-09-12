import { AppConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { ControlUnitLockModule } from '@culock';
import { TRACING_ID } from '@framework/constants';
import { AppLoggerModule } from '@framework/logger';
import { PublisherModule } from '@framework/publisher';
import { snowflakeId } from '@framework/snowflake';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SerialportModule, SerialportModuleConfig } from '@serialport';
import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

import { configs } from './config';
import { MqttConfig } from './config/mqtt.config';
import { LockTrackerController } from './lock-tracker.controller';
import { LockTrackerService } from './lock-tracker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configs],
      isGlobal: true,
      cache: true,
    }),
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
            enabled: true,
            options: config.publisher,
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
    ControlUnitLockModule,
  ],
  controllers: [LockTrackerController],
  providers: [LockTrackerService],
})
export class LockTrackerModule {}
