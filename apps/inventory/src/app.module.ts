import { AppConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { API_MODELS, API_MONGO_REPOSITORIES, MongoDALModule } from '@dals/mongo';
import { TRACING_ID } from '@framework/constants';
import { AppLoggerModule } from '@framework/logger';
import { PublisherModule } from '@framework/publisher';
import { snowflakeId } from '@framework/snowflake';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ServicesModule } from '@services';
import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

import { configs } from './config';
import { AuthConfig } from './config/auth.config';
import { MqttConfig } from './config/mqtt.config';
import { AuthModule, JwtAuthMiddleware } from './module/auth';
import { DeviceKeyAuthMiddleware } from './module/auth/middlewares';
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
        const mongoConfig = configService.get(CONFIG_KEY.MONGO);
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
          tcp: {
            enabled: true,
            options: {
              host: '192.168.0.103',
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
    // FingerprintScanModule.forRootAsync({
    //   useFactory: (configService: ConfigService) => {
    //     const config = configService.getOrThrow<FingerprintConfig>(CONFIG_KEY.FINGERPRINT);
    //     return {
    //       ...DEFAULT_CONFIG,
    //       binaryPath: config.binaryPath,
    //       devicePort: config.defaultPort,
    //       maxCommandAge: 30000, // 30s
    //       logLevel: 'debug',
    //     };
    //   },
    //   inject: [ConfigService],
    // }),
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
    consumer.apply(JwtAuthMiddleware).forRoutes(...['/items']);
  }
}
