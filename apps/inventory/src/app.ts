import { AppConfig, SwaggerConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { setupSwagger, setupValidation } from '@framework/bootstrap';
import { GlobalExceptionFilter } from '@framework/filter';
import { HandleResponseInterceptor } from '@framework/interceptor';
import { APP_LOGGER } from '@framework/logger';
import { MikroORM } from '@mikro-orm/core';
import { INestApplication, Logger } from '@nestjs/common';
import { ShutdownSignal } from '@nestjs/common/enums/shutdown-signal.enum';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MqttOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';
import { MqttConfig } from './config/mqtt.config';
import { TcpConfig } from './config/tcp.config';

export class InventoryApplication {
  private static _handlerUnhandedRejection() {
    process.on('unhandledRejection', async (reason: any, p) => {
      if ('codeName' in reason && reason.codeName === 'IndexKeySpecsConflict') {
        // DB info skip.
      } else {
        Logger.warn(`Unhandled exception reason:`, reason, InventoryApplication.name);
      }
    });
  }

  private static _handlerUnhandException(app: INestApplication): void {
    process.on('uncaughtException', async (err) => {
      app.close().finally(() => {
        Logger.error('Fatal Error. Process exit', err, InventoryApplication.name);
        process.exit(1);
      });
    });
  }

  private static async _bootstrapMicroservices(app: INestApplication, configService: ConfigService): Promise<void> {
    await this._connectMqtt(app, configService);
    await app.startAllMicroservices();
  }

  private static async _setupDatabase(app: INestApplication): Promise<void> {
    try {
      await app.get(MikroORM).getSchemaGenerator().ensureDatabase();
      await app.get(MikroORM).getSchemaGenerator().updateSchema();
    } catch (error) {
      // ignore.
    }
  }

  private static async _connectMqtt(app: INestApplication, configService: ConfigService): Promise<void> {
    const mqttConfig = configService.getOrThrow<MqttConfig>(CONFIG_KEY.MQTT);
    app.connectMicroservice<MqttOptions>(
      {
        transport: Transport.MQTT,
        options: {
          ...mqttConfig.consumer,
          resubscribe: true,
          reschedulePings: true,
          // use v5 to support userProperties
          protocolVersion: 5,
        },
      },
      { inheritAppConfig: true },
    );
  }

  private static _setupSwagger(app: INestApplication, configService: ConfigService) {
    const swaggerConfig = configService.getOrThrow<SwaggerConfig>(CONFIG_KEY.SWAGGER);
    return setupSwagger(app, swaggerConfig);
  }

  private static async _bootstrap(): Promise<void> {
    this._handlerUnhandedRejection();
    const app = await NestFactory.create(AppModule, {
      bufferLogs: process.env.BUFFER_LOG === 'true',
      abortOnError: false,
    });
    this._handlerUnhandException(app);

    app.useLogger(app.get(APP_LOGGER));

    const configService = app.get(ConfigService);

    const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEY.APP);

    await this._setupDatabase(app);

    app.setGlobalPrefix(appConfig.apiPrefix);
    app.useGlobalPipes(setupValidation(app, AppModule));
    app.useGlobalFilters(new GlobalExceptionFilter(appConfig.debug));
    app.useGlobalInterceptors(new HandleResponseInterceptor());
    app.enableShutdownHooks(Object.values(ShutdownSignal));

    this._setupSwagger(app, configService);

    await this._bootstrapMicroservices(app, configService);
    await app.listen(appConfig.port);

    this._appInfo(configService);
  }

  private static _appInfo(configService: ConfigService) {
    const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEY.APP);
    Logger.log(`🚀 ${appConfig.name} v${appConfig.version} started`, InventoryApplication.name);
    Logger.log(`📡 HTTP server listening on port: ${appConfig.port}`, InventoryApplication.name);

    const mqttConfig = configService.getOrThrow<MqttConfig>(CONFIG_KEY.MQTT);
    const tcpConfig = configService.get<TcpConfig>(CONFIG_KEY.TCP);

    if (tcpConfig?.publisher?.host) {
      Logger.log(`🔌 TCP Publisher: ${tcpConfig.publisher.host}:${tcpConfig.publisher.port}`, InventoryApplication.name);
    }
    if (tcpConfig?.consumer?.host) {
      Logger.log(`🔌 TCP Consumer: ${tcpConfig.consumer?.host}:${tcpConfig.consumer?.port}`, InventoryApplication.name);
    }

    if (mqttConfig.publisher?.url) {
      Logger.log(`📡 MQTT Publisher URI: ${mqttConfig.publisher?.url}`, InventoryApplication.name);
    }
    if (mqttConfig.consumer?.url) {
      Logger.log(`📡 MQTT Consumer URI: ${mqttConfig.consumer?.url}`, InventoryApplication.name);
    }
  }

  public static start(): void {
    this._bootstrap().catch((error) => Logger.error(error.message, InventoryApplication.name));
  }
}
