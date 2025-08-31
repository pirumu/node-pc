import { AppConfig, buildSSLConfig, MongoDBConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { MongoDALModule, ALL_ENTITIES } from '@dals/mongo';
import { TRACING_ID } from '@framework/constants';
import { AppLoggerModule } from '@framework/logger';
import { PublisherModule } from '@framework/publisher';
import { snowflakeId } from '@framework/snowflake';
import { MongoHighlighter } from '@mikro-orm/mongo-highlighter';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

import { configs } from './config';
import { MqttConfig } from './config/mqtt.config';
import { TcpConfig } from './config/tcp.config';
import { LoadcellModule } from './modules/loadcell';
import { TransactionModule } from './modules/transaction';

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

        const sslConfig = buildSSLConfig(mongoConfig.ssl);
        if (sslConfig) {
          driverOptions.connection.ssl = sslConfig;
          driverOptions.connection.tls = true;
        }

        return {
          driver: MongoDriver,
          entities: ALL_ENTITIES,
          clientUrl: mongoConfig.uri,
          driverOptions,
          debug: true,
          ensureDatabase: true,
          logLevel: mongoConfig.logLevel || 'info',
          highlighter: new MongoHighlighter(),
          logger: (msg) => Logger.log(msg, 'MikroORM-ProcessWorker'),
        };
      },
      inject: [ConfigService],
      driver: MongoDriver,
      entities: [...ALL_ENTITIES],
    }),
    PublisherModule.forRootAsync({
      global: true,
      useFactory: (configService: ConfigService) => {
        const mqttConfig = configService.getOrThrow<MqttConfig>(CONFIG_KEY.MQTT);
        const tcpConfig = configService.getOrThrow<TcpConfig>(CONFIG_KEY.TCP);
        return {
          tcp: {
            enabled: true,
            options: tcpConfig.publisher as any,
          },
          mqtt: {
            options: mqttConfig.publisher,
            enabled: true,
          },
        };
      },
      inject: [ConfigService],
    }),
    LoadcellModule,
    TransactionModule,
  ],
})
export class AppModule {}
