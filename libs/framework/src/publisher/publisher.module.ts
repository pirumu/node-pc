import { Module, DynamicModule, Provider } from '@nestjs/common';

import { MultiTransportPublisher } from './multi-transport.publisher';
import { PUBLISHER_MODULE_OPTIONS, MQTT_PUBLISHER, TCP_PUBLISHER, HTTP_PUBLISHER, MULTI_PUBLISHER } from './publisher.constants';
import { PublisherFactory } from './publisher.factory';
import { PublisherModuleOptions, PublisherModuleAsyncOptions, PublisherOptionsFactory } from './publisher.interfaces';
import { PublisherService } from './publisher.service';
import { IPublisher, Transport } from './publisher.types';

@Module({})
export class PublisherModule {
  public static forRoot(options: PublisherModuleOptions): DynamicModule {
    const providers = this._createProviders(options);
    const imports = [...(options.imports || [])];
    return {
      module: PublisherModule,
      global: options.global,
      imports: imports,
      providers: [
        {
          provide: PUBLISHER_MODULE_OPTIONS,
          useValue: options,
        },
        ...providers,
        PublisherService,
      ],
      exports: [MQTT_PUBLISHER, TCP_PUBLISHER, HTTP_PUBLISHER, MULTI_PUBLISHER, PublisherService],
    };
  }

  public static forRootAsync(options: PublisherModuleAsyncOptions): DynamicModule {
    const asyncProviders = this._createAsyncProviders(options);
    const providers = this._createAsyncPublisherProviders();
    const imports = [...(options.imports || [])];

    return {
      module: PublisherModule,
      global: options.global,
      imports,
      providers: [...asyncProviders, ...providers, PublisherService],
      exports: [MQTT_PUBLISHER, TCP_PUBLISHER, HTTP_PUBLISHER, MULTI_PUBLISHER, PublisherService],
    };
  }

  private static _createProviders(options: PublisherModuleOptions): Provider[] {
    const providers: Provider[] = [];

    // MQTT Publisher
    if (options.mqtt?.options && options.mqtt?.enabled) {
      const publisher = PublisherFactory.createMQTTPublisher(options.mqtt.options);
      providers.push({
        provide: MQTT_PUBLISHER,
        useFactory: () => {
          return publisher;
        },
        inject: [],
      });
    }

    // TCP Publisher
    if (options.tcp?.options && options.tcp?.enabled) {
      const publisher = PublisherFactory.createTCPPublisher(options.tcp.options);
      providers.push({
        provide: TCP_PUBLISHER,
        useFactory: () => {
          return publisher;
        },
      });
    }

    // HTTP Publisher
    if (options.http?.options && options.http?.enabled) {
      const publisher = PublisherFactory.createHTTPPublisher(options.http.options);
      providers.push({
        provide: HTTP_PUBLISHER,
        useFactory: () => {
          return publisher;
        },
        inject: [],
      });
    }

    // Multi Publisher
    providers.push({
      provide: MULTI_PUBLISHER,
      useFactory: (...publishers: IPublisher[]) => {
        const multiPublisher = new MultiTransportPublisher();

        if (options.mqtt?.enabled && publishers[0]) {
          multiPublisher.addPublisher(Transport.MQTT, publishers[0]);
        }
        if (options.tcp?.enabled && publishers[1]) {
          multiPublisher.addPublisher(Transport.TCP, publishers[1]);
        }
        if (options.http?.enabled && publishers[2]) {
          multiPublisher.addPublisher(Transport.HTTP, publishers[2]);
        }

        return multiPublisher;
      },
      inject: [
        ...(options.mqtt?.enabled ? [MQTT_PUBLISHER] : []),
        ...(options.tcp?.enabled ? [TCP_PUBLISHER] : []),
        ...(options.http?.enabled ? [HTTP_PUBLISHER] : []),
      ],
    });

    return providers;
  }

  private static _createAsyncProviders(options: PublisherModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: PUBLISHER_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: PUBLISHER_MODULE_OPTIONS,
          useFactory: async (optionsFactory: PublisherOptionsFactory) => await optionsFactory.createPublisherOptions(),
          inject: [options.useClass],
        },
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: PUBLISHER_MODULE_OPTIONS,
          useFactory: async (optionsFactory: PublisherOptionsFactory) => await optionsFactory.createPublisherOptions(),
          inject: [options.useExisting],
        },
      ];
    }

    return [];
  }

  private static _createAsyncPublisherProviders(): Provider[] {
    return [
      // MQTT Publisher
      {
        provide: MQTT_PUBLISHER,
        useFactory: (options: PublisherModuleOptions) => {
          if (!options.mqtt?.options || !options.mqtt?.enabled) {
            return null;
          }
          return PublisherFactory.createMQTTPublisher(options.mqtt.options);
        },
        inject: [PUBLISHER_MODULE_OPTIONS],
      },
      // TCP Publisher
      {
        provide: TCP_PUBLISHER,
        useFactory: (options: PublisherModuleOptions) => {
          if (!options.tcp?.options && !options.tcp?.enabled) {
            return null;
          }
          return PublisherFactory.createTCPPublisher(options.tcp.options);
        },
        inject: [PUBLISHER_MODULE_OPTIONS],
      },
      // HTTP Publisher
      {
        provide: HTTP_PUBLISHER,
        useFactory: (options: PublisherModuleOptions) => {
          if (!options.http?.options || !options.http?.enabled) {
            return null;
          }
          return PublisherFactory.createHTTPPublisher(options.http.options);
        },
        inject: [PUBLISHER_MODULE_OPTIONS],
      },
      // Multi Publisher
      {
        provide: MULTI_PUBLISHER,
        useFactory: (options: PublisherModuleOptions, mqttPublisher: IPublisher, tcpPublisher: IPublisher, httpPublisher: IPublisher) => {
          const multiPublisher = new MultiTransportPublisher();

          if (options.mqtt?.enabled && mqttPublisher) {
            multiPublisher.addPublisher(Transport.MQTT, mqttPublisher);
          }
          if (options.tcp?.enabled && tcpPublisher) {
            multiPublisher.addPublisher(Transport.TCP, tcpPublisher);
          }
          if (options.http?.enabled && httpPublisher) {
            multiPublisher.addPublisher(Transport.HTTP, httpPublisher);
          }

          return multiPublisher;
        },
        inject: [PUBLISHER_MODULE_OPTIONS, MQTT_PUBLISHER, TCP_PUBLISHER, HTTP_PUBLISHER],
      },
    ];
  }
}
