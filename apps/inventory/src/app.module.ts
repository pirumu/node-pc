import { AppConfig, buildSSLConfig, MongoDBConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { MongoDALModule, ALL_ENTITIES } from '@dals/mongo';
import { TRACING_ID } from '@framework/constants';
import { AppLoggerModule } from '@framework/logger';
import { PublisherModule } from '@framework/publisher';
import { snowflakeId } from '@framework/snowflake';
import { MongoHighlighter } from '@mikro-orm/mongo-highlighter';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ServicesModule } from '@services';
import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

import { configs } from './config';
import { AuthConfig } from './config/auth.config';
import { MqttConfig } from './config/mqtt.config';
import { AuthModule, JwtAuthMiddleware } from './module/auth';
import { INVENTORY_MODULES } from './module/inventory';
import { SYSTEM_MODULES } from './module/system';
import { WsModule } from './module/ws';

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
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtConfig = configService.getOrThrow<AuthConfig>(CONFIG_KEY.AUTH);
        return {
          secret: jwtConfig.secret,
          signOptions: {
            expiresIn: jwtConfig.expiresIn,
          },
        };
      },
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
          readPreference: 'primary',
        };

        if (sslConfig) {
          driverOptions.connection.ssl = sslConfig;
          driverOptions.connection.tls = true;
        }

        return {
          driver: MongoDriver,
          entities: ALL_ENTITIES,
          clientUrl: mongoConfig.uri,
          replicas: [
            {
              host: '127.0.0.1:27018',
              name: mongoConfig.replicaSet || 'rs0',
            },
          ],
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
      entities: [...ALL_ENTITIES],
    }),
    PublisherModule.forRootAsync({
      global: true,
      useFactory: (configService: ConfigService) => {
        const mqttConfig = configService.getOrThrow<MqttConfig>(CONFIG_KEY.MQTT);

        return {
          tcp: {
            enabled: true,
            options: {
              host: '192.168.0.107',
              port: 3003,
            },
          },
          mqtt: {
            options: mqttConfig.publisher,
            enabled: true,
          },
        };
      },
      inject: [ConfigService],
    }),
    ServicesModule,
    AuthModule,
    ...INVENTORY_MODULES,
    ...SYSTEM_MODULES,
    WsModule,
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    // consumer.apply(DeviceKeyAuthMiddleware).forRoutes(...['/ports']);
    consumer.apply(JwtAuthMiddleware).forRoutes(...['/items', '/users']);
  }
}
