import { AppConfig, SwaggerConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { setupSwagger } from '@framework/bootstrap';
import { GlobalRpcExceptionFilter } from '@framework/filter';
import { APP_LOGGER } from '@framework/logger';
import { MikroORM } from '@mikro-orm/core';
import { INestApplication, Logger } from '@nestjs/common';
import { ShutdownSignal } from '@nestjs/common/enums/shutdown-signal.enum';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { SyncWorkerModule } from './api/sync-worker.module';
import { MqttConfig } from './config/mqtt.config';

export class SyncWorkerApplication {
  private static _handlerUnhandedRejection() {
    process.on('unhandledRejection', async (reason: any, p) => {
      if ('codeName' in reason && reason.codeName === 'IndexKeySpecsConflict') {
        // DB info skip.
      } else {
        Logger.warn(`Unhandled exception reason:`, reason, SyncWorkerApplication.name);
      }
    });
  }

  private static _handlerUnhandException(app: INestApplication): void {
    process.on('uncaughtException', async (err) => {
      app.close().finally(() => {
        Logger.error('Fatal Error. Process exit', err, SyncWorkerApplication.name);
        process.exit(1);
      });
    });
  }

  private static async _setupDatabase(app: INestApplication): Promise<void> {
    try {
      await app.get(MikroORM).getSchemaGenerator().ensureDatabase();
    } catch (error) {
      // ignore.
    }
  }

  private static _setupSwagger(app: INestApplication, configService: ConfigService) {
    const swaggerConfig = configService.getOrThrow<SwaggerConfig>(CONFIG_KEY.SWAGGER);
    return setupSwagger(app, swaggerConfig);
  }

  private static async _bootstrap(): Promise<void> {
    this._handlerUnhandedRejection();
    const app = await NestFactory.create(SyncWorkerModule, {
      bufferLogs: process.env.BUFFER_LOG === 'true',
      abortOnError: true,
    });

    this._handlerUnhandException(app);

    app.useLogger(app.get(APP_LOGGER));

    const configService = app.get(ConfigService);

    const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEY.APP);

    await this._setupDatabase(app);

    app.useGlobalFilters(new GlobalRpcExceptionFilter(appConfig.debug));
    app.enableShutdownHooks(Object.values(ShutdownSignal));

    this._setupSwagger(app, configService);

    await app.listen(appConfig.port);

    this._appInfo(configService);
  }

  private static _appInfo(configService: ConfigService) {
    const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEY.APP);
    Logger.log(`🚀 ${appConfig.name} v${appConfig.version} started`, SyncWorkerApplication.name);
    Logger.log(`📡 HTTP server listening on port: ${appConfig.port}`, SyncWorkerApplication.name);

    const mqttConfig = configService.getOrThrow<MqttConfig>(CONFIG_KEY.MQTT);

    if (mqttConfig.publisher?.url) {
      Logger.log(`📡 MQTT Publisher URI: ${mqttConfig.publisher?.url}`, SyncWorkerApplication.name);
    }
  }

  public static start(): void {
    this._bootstrap().catch((error) => Logger.error(error.message, SyncWorkerApplication.name));
  }
}
