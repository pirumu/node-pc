import { AppLoggerService } from '@framework/logger/app-logger.service';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';

import { APP_LOGGER, APP_LOGGER_OPTIONS } from './app-logger.constants';
import { AppLoggerModuleAsyncOptions, AppLoggerModuleOptions } from './app-logger.module.interface';
import { ConfigurationFactory } from './configuration.factory';

@Module({})
export class AppLoggerModule {
  /**
   * Create module with asynchronous options
   */
  static forRootAsync(options: AppLoggerModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      ...this.createAsyncProviders(options),
      {
        provide: APP_LOGGER,
        inject: [ClsService, APP_LOGGER_OPTIONS],
        useFactory: (cls: ClsService, loggerOptions: AppLoggerModuleOptions) => {
          const factory = new ConfigurationFactory(cls, loggerOptions);
          return new AppLoggerService(factory.createLoggerConfiguration(), cls);
        },
      },
    ];

    return {
      module: AppLoggerModule,
      global: options.global ?? true,
      imports: [
        ...(options.imports || []),
        LoggerModule.forRootAsync({
          inject: [ClsService, APP_LOGGER_OPTIONS],
          useFactory: (cls: ClsService, loggerOptions: AppLoggerModuleOptions) => {
            const factory = new ConfigurationFactory(cls, loggerOptions);
            return factory.createHttpLoggerConfiguration();
          },
        }),
      ],
      providers,
      exports: [APP_LOGGER, LoggerModule, APP_LOGGER_OPTIONS],
    };
  }

  private static createAsyncProviders(options: AppLoggerModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: APP_LOGGER_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: APP_LOGGER_OPTIONS,
          useClass: options.useClass,
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: APP_LOGGER_OPTIONS,
          useExisting: options.useExisting,
        },
      ];
    }

    return [];
  }
}
