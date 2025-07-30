import { Module, DynamicModule, Provider, Type } from '@nestjs/common';

import { FINGERPRINT_SCAN_CONFIG } from './fingerprint-scan.constants';
import { IFingerprintScanConfig, DEFAULT_CONFIG } from './interfaces/config.interface';
import { ContextManagerService } from './services/context-manager.service';
import { FingerprintCommandService } from './services/fingerprint-command.service';
import { FingerprintContextService } from './services/fingerprint-context.service';
import { FingerprintProcessService } from './services/fingerprint-process.service';
import { FingerprintResponseService } from './services/fingerprint-response.service';
import { FingerprintScanService } from './services/fingerprint-scan.service';
import { HookRegistryService } from './services/hook-registry.service';

export type FingerprintScanOptionsFactory = {
  createFingerprintScanOptions(): Promise<IFingerprintScanConfig> | IFingerprintScanConfig;
};

export type FingerprintScanAsyncOptions = {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<IFingerprintScanConfig> | IFingerprintScanConfig;
  useExisting?: Type<FingerprintScanOptionsFactory>;
  useClass?: Type<FingerprintScanOptionsFactory>;
  inject?: any[];
};

@Module({})
export class FingerprintScanModule {
  public static forRootAsync(options: FingerprintScanAsyncOptions): DynamicModule {
    return {
      global: true,
      module: FingerprintScanModule,
      imports: options.imports || [],
      providers: [
        ...this._createAsyncProviders(options),
        ContextManagerService,
        HookRegistryService,
        FingerprintContextService,
        FingerprintProcessService,
        FingerprintCommandService,
        FingerprintResponseService,
        FingerprintScanService,
      ],
      exports: [
        FINGERPRINT_SCAN_CONFIG,
        ContextManagerService,
        HookRegistryService,
        FingerprintContextService,
        FingerprintProcessService,
        FingerprintCommandService,
        FingerprintResponseService,
        FingerprintScanService,
      ],
    };
  }

  private static _createAsyncProviders(options: FingerprintScanAsyncOptions): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this._createAsyncOptionsProvider(options)];
    }

    const useClass = options.useClass as Type<FingerprintScanOptionsFactory>;
    return [
      this._createAsyncOptionsProvider(options),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static _createAsyncOptionsProvider(options: FingerprintScanAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: FINGERPRINT_SCAN_CONFIG,
        useFactory: async (...args: any[]) => {
          const config = await options.useFactory!(...args);
          return { ...DEFAULT_CONFIG, ...config };
        },
        inject: options.inject || [],
      };
    }

    const inject = [(options.useClass || options.useExisting) as Type<FingerprintScanOptionsFactory>];

    return {
      provide: FINGERPRINT_SCAN_CONFIG,
      useFactory: async (optionsFactory: FingerprintScanOptionsFactory) => {
        const config = await optionsFactory.createFingerprintScanOptions();
        return { ...DEFAULT_CONFIG, ...config };
      },
      inject,
    };
  }
}
