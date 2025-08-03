import { AppConfig, MongoDBConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { API_MODELS, API_MONGO_REPOSITORIES, MongoDALModule } from '@dals/mongo';
import { TRACING_ID } from '@framework/constants';
import { AppLoggerModule } from '@framework/logger';
import { PublisherModule } from '@framework/publisher';
import { snowflakeId } from '@framework/snowflake';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

import { configs } from './config';
import { DeviceModule } from './module/device/device.module';
import { MonitoringModule } from './module/monitoring/monitoring.module';
import { NotificationModule } from './module/notification/notification.module';
import { SyncModule } from './module/sync/sync.module';
import { MqttConfig } from './config/mqtt.config';

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
    MongoDALModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const mongoConfig = configService.getOrThrow<MongoDBConfig>(CONFIG_KEY.MONGO);
        return {
          uri: mongoConfig.uri,
          maxPoolSize: mongoConfig.maxPoolSize,
          minPoolSize: mongoConfig.minPoolSize,
          serverSelectionTimeoutMS: mongoConfig.serverSelectionTimeoutMS,
          socketTimeoutMS: mongoConfig.socketTimeoutMS,
          connectTimeoutMS: mongoConfig.connectTimeoutMS,
          heartbeatFrequencyMS: mongoConfig.heartbeatFrequencyMS,
          retryWrites: mongoConfig.retryWrites,
          retryReads: mongoConfig.retryReads,
          bufferCommands: mongoConfig.bufferCommands,
          ssl: mongoConfig.ssl,
          ...(mongoConfig.sslCA && { sslCA: mongoConfig.sslCA }),
          ...(mongoConfig.sslCert && {
            sslCert: mongoConfig.sslCert,
          }),
          ...(mongoConfig.sslKey && { sslKey: mongoConfig.sslKey }),
        };
      },
      inject: [ConfigService],
      models: [...API_MODELS],
      repositories: [...API_MONGO_REPOSITORIES],
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
    SyncModule,
    MonitoringModule,
    NotificationModule,
    DeviceModule,
  ],
  controllers: [],
  providers: [],
})
export class WorkerModule {}
