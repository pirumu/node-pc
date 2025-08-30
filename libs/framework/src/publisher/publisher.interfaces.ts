import { HTTPPublishConfigOptions } from '@framework/publisher/http/http.types';
import { ModuleMetadata, Type } from '@nestjs/common';

import { MQTTPublishOptions } from './mqtt';
import { Transport } from './publisher.types';
import { TCPPublishOptions } from './tcp';

type PublisherOptions<T = Transport> = {
  enabled: boolean;
} & (T extends Transport.MQTT
  ? { options: MQTTPublishOptions }
  : T extends Transport.TCP
    ? { options: TCPPublishOptions }
    : T extends Transport.HTTP
      ? { options: HTTPPublishConfigOptions }
      : never);

export type PublisherModuleOptions = {
  mqtt?: PublisherOptions<Transport.MQTT>;
  tcp?: PublisherOptions<Transport.TCP>;
  http?: PublisherOptions<Transport.HTTP>;
  global?: boolean;
  imports?: ModuleMetadata['imports'];
};

export type PublisherOptionsFactory = {
  createPublisherOptions(): Promise<PublisherModuleOptions> | PublisherModuleOptions;
};

export type PublisherModuleAsyncOptions = Pick<ModuleMetadata, 'imports'> & {
  global?: boolean;
  useExisting?: Type<PublisherOptionsFactory>;
  useClass?: Type<PublisherOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<PublisherModuleOptions> | PublisherModuleOptions;
  inject?: any[];
};
