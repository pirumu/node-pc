import { DynamicModule, Module } from '@nestjs/common';

import { HTTP_MODULE_OPTIONS, HTTP_CLIENT_SERVICE } from './http-client.constants';
import { HttpModuleOptions } from './http-client.interfaces';
import { HttpClientService } from './http-client.service';

export type HttpModuleAsyncOptions = {
  imports?: DynamicModule['imports'];
  useFactory: (...args: any[]) => Promise<HttpModuleOptions> | HttpModuleOptions;
  inject?: any[];
};

@Module({})
export class HttpModule {
  public static forRegisterAsync(options: HttpModuleAsyncOptions): DynamicModule {
    return {
      module: HttpModule,
      imports: options.imports || [],
      providers: [
        {
          provide: HTTP_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: HTTP_CLIENT_SERVICE,
          useClass: HttpClientService,
        },
      ],
      exports: [HTTP_CLIENT_SERVICE],
    };
  }
}
