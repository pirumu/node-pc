import { AppConfig, MongoDBConfig, buildSSLConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { MongoDALModule, SYNC_WORKER_ENTITIES } from '@dals/mongo';
import { TRACING_ID } from '@framework/constants';
import { AppLoggerModule } from '@framework/logger';
import { PublisherModule } from '@framework/publisher';
import { snowflakeId } from '@framework/snowflake';
import { MongoHighlighter } from '@mikro-orm/mongo-highlighter';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServicesModule } from '@services';
import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

import { configs } from './config';
import { MqttConfig } from './config/mqtt.config';
import { LocalToCloudModule } from './local-to-cloud';
import { SyncWorkerController } from './sync-worker.controller';
import { SyncWorkerService } from './sync-worker.service';

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
        const sslConfig = buildSSLConfig(mongoConfig.ssl);
        const driverOptions: Record<string, any> = {
          maxPoolSize: mongoConfig.maxPoolSize,
          minPoolSize: mongoConfig.minPoolSize,
          serverSelectionTimeoutMS: mongoConfig.serverSelectionTimeoutMS,
          socketTimeoutMS: mongoConfig.socketTimeoutMS,
          connectTimeoutMS: mongoConfig.connectTimeoutMS,
          heartbeatFrequencyMS: mongoConfig.heartbeatFrequencyMS,
          retryWrites: mongoConfig.retryWrites,
          retryReads: mongoConfig.retryReads,
        };

        if (sslConfig) {
          driverOptions.connection.ssl = sslConfig;
          driverOptions.connection.tls = true;
        }

        return {
          driver: MongoDriver,
          replicas: [
            {
              host: '127.0.0.1:20212',
              name: mongoConfig.replicaSet,
            },
          ],
          entities: SYNC_WORKER_ENTITIES,
          clientUrl: mongoConfig.uri,
          driverOptions,
          debug: true,
          logLevel: mongoConfig.logLevel || 'info',
          highlighter: new MongoHighlighter(),
          discovery: {
            checkDuplicateFieldNames: true,
            checkDuplicateEntities: true,
            checkNonPersistentCompositeProps: true,
          },
          logger: (msg) => Logger.log(msg, 'MikroORM'),
        };
      },
      inject: [ConfigService],
      driver: MongoDriver,
      entities: [...SYNC_WORKER_ENTITIES],
    }),
    PublisherModule.forRootAsync({
      global: true,
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<MqttConfig>(CONFIG_KEY.MQTT);
        return {
          tcp: {
            enabled: true,
            options: {
              host: '192.168.0.107',
              port: 3002,
            },
          },
          mqtt: {
            options: config.publisher,
            enabled: true,
          },
        };
      },
      inject: [ConfigService],
    }),
    ServicesModule,
    LocalToCloudModule,
  ],
  controllers: [SyncWorkerController],
  providers: [SyncWorkerService],
})
export class SyncWorkerModule {}
