import { AppConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { GlobalRpcExceptionFilter } from '@framework/filter';
import { APP_LOGGER } from '@framework/logger';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MqttOptions, Transport } from '@nestjs/microservices';

import { MqttConfig } from './config/mqtt.config';
import { LockTrackerModule } from './lock-tracker.module';

export class LockTrackerApplication {
  private static _handlerUnhandException(app: INestApplication): void {
    process.on('uncaughtException', async (err) => {
      app.close().finally(() => {
        Logger.error('Fatal Error. Process exit', err, LockTrackerApplication.name);
        process.exit(1);
      });
    });
  }

  private static async _bootstrapMicroservices(app: INestApplication, configService: ConfigService): Promise<void> {
    await this._connectMqtt(app, configService);
    await app.startAllMicroservices();
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
        },
      },
      { inheritAppConfig: true },
    );
  }

  private static async _bootstrap(): Promise<void> {
    const app = await NestFactory.create(LockTrackerModule, {
      bufferLogs: process.env.BUFFER_LOG === 'true',
      abortOnError: true,
    });
    this._handlerUnhandException(app);

    app.useLogger(app.get(APP_LOGGER));

    const configService = app.get(ConfigService);

    const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEY.APP);

    app.setGlobalPrefix(appConfig.apiPrefix);
    app.useGlobalFilters(new GlobalRpcExceptionFilter(appConfig.debug));
    app.enableShutdownHooks();

    await this._bootstrapMicroservices(app, configService);

    await app.listen(appConfig.port);
    this._appInfo(configService);
  }

  private static _appInfo(configService: ConfigService) {
    const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEY.APP);
    Logger.log(`🚀 ${appConfig.name} v${appConfig.version} started`, LockTrackerApplication.name);
    Logger.log(`📡 HTTP server listening on port: ${appConfig.port}`, LockTrackerApplication.name);

    const mqttConfig = configService.getOrThrow<MqttConfig>(CONFIG_KEY.MQTT);

    if (mqttConfig.publisher?.url) {
      Logger.log(`📡 MQTT Publisher URI: ${mqttConfig.publisher?.url}`, LockTrackerApplication.name);
    }
    if (mqttConfig.consumer?.url) {
      Logger.log(`📡 MQTT Consumer URI: ${mqttConfig.consumer?.url}`, LockTrackerApplication.name);
    }
  }

  public static start(): void {
    this._bootstrap().catch((error) => Logger.error(error.message, LockTrackerApplication.name));
  }
}
