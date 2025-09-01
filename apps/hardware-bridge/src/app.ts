import { AppConfig, SwaggerConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { setupSwagger } from '@framework/bootstrap';
import { GlobalExceptionFilter, GlobalRpcExceptionFilter } from '@framework/filter';
import { APP_LOGGER } from '@framework/logger';
import { INestApplication, Logger } from '@nestjs/common';
import { ShutdownSignal } from '@nestjs/common/enums/shutdown-signal.enum';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MqttOptions, TcpOptions, Transport } from '@nestjs/microservices';

import { MqttConfig } from './config/mqtt.config';
import { TcpConfig } from './config/tcp.config';
import { HwbModule } from './hwb.module';

export class Application {
  private static async _bootstrapMicroservices(app: INestApplication, configService: ConfigService): Promise<void> {
    await Promise.all([this._connectMqtt(app, configService), this._connectTcp(app, configService)]);
    await app.startAllMicroservices();
  }

  private static async _connectMqtt(app: INestApplication, configService: ConfigService): Promise<void> {
    const mqttConfig = configService.getOrThrow<MqttConfig>(CONFIG_KEY.MQTT);
    const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEY.APP);
    app.connectMicroservice<TcpOptions>(
      {
        transport: Transport.TCP,
        options: {
          host: '0.0.0.0',
          port: appConfig.port,
        },
      },
      { inheritAppConfig: true },
    );
    app.connectMicroservice<MqttOptions>(
      {
        transport: Transport.MQTT,
        options: {
          ...mqttConfig.consumer,
          resubscribe: true,
          reschedulePings: true,
        },
      },
      { inheritAppConfig: true },
    );
  }

  private static async _connectTcp(app: INestApplication, configService: ConfigService): Promise<void> {
    const tcpConfig = configService.getOrThrow<TcpConfig>(CONFIG_KEY.TCP);
    app.connectMicroservice<TcpOptions>(
      {
        transport: Transport.TCP,
        options: {
          ...tcpConfig.consumer,
          retryAttempts: 3,
          retryDelay: 1000,
        },
      },
      { inheritAppConfig: true },
    );
  }

  private static _setupSwagger(app: INestApplication, configService: ConfigService): void {
    const swaggerConfig = configService.getOrThrow<SwaggerConfig>(CONFIG_KEY.SWAGGER);
    return setupSwagger(app, swaggerConfig);
  }

  private static async _bootstrap(): Promise<void> {
    const app = await NestFactory.create(HwbModule, {
      bufferLogs: false,
      abortOnError: true,
    });
    app.useLogger(app.get(APP_LOGGER));

    const configService = app.get(ConfigService);

    const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEY.APP);

    app.setGlobalPrefix(appConfig.apiPrefix);
    // app.useGlobalPipes(setupValidation(app, HwbModule));
    app.useGlobalFilters(new GlobalExceptionFilter(appConfig.debug));
    app.useGlobalFilters(new GlobalRpcExceptionFilter(appConfig.debug));
    app.enableShutdownHooks(Object.values(ShutdownSignal));

    this._setupSwagger(app, configService);

    await this._bootstrapMicroservices(app, configService);
    await app.listen(appConfig.port);

    Logger.log(`${appConfig.name} listen in ${appConfig.url}`, Application.name);
  }

  public static start(): void {
    this._bootstrap().catch((error) => Logger.error(error.message, Application.name));
  }
}
