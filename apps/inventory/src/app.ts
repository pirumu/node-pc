import { AppConfig, SwaggerConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { setupSwagger, setupValidation } from '@framework/bootstrap';
import { GlobalExceptionFilter } from '@framework/filter';
import { HandleResponseInterceptor } from '@framework/interceptor';
import { APP_LOGGER } from '@framework/logger';
import { INestApplication, Logger } from '@nestjs/common';
import { ShutdownSignal } from '@nestjs/common/enums/shutdown-signal.enum';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MqttOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';
import { MqttConfig } from './config/mqtt.config';

export class Application {
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
          ...mqttConfig,
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
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
      abortOnError: false,
    });
    app.useLogger(app.get(APP_LOGGER));

    const configService = app.get(ConfigService);

    const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEY.APP);

    app.setGlobalPrefix(appConfig.apiPrefix);
    app.useGlobalPipes(setupValidation(app, AppModule));
    app.useGlobalFilters(new GlobalExceptionFilter(appConfig.debug));
    app.useGlobalInterceptors(new HandleResponseInterceptor());
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
