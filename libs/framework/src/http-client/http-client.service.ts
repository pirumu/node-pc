import { Inject, Logger } from '@nestjs/common';

import { HTTP_MODULE_OPTIONS } from './http-client.constants';
import { HttpClientFactory } from './http-client.factory';
import {
  HttpModuleOptions,
  IHttpClient,
  IHttpMiddleware,
  IHttpServiceRequestOptions,
  IHttpServiceResponse,
} from './http-client.interfaces';
import { LoggingMiddleware } from './middlewares/logging.middleware';

export class HttpClientService {
  private readonly _client: IHttpClient;

  constructor(
    @Inject(HTTP_MODULE_OPTIONS)
    private readonly _options: HttpModuleOptions,
  ) {
    this._client = HttpClientFactory.create(this._options.clientType, this._options.clientOptions);
    this._setupDefaultMiddlewares();
  }

  private _setupDefaultMiddlewares(): void {
    this._client.use(new LoggingMiddleware(new Logger(HttpClientService.name)));
  }

  public async get<T = any>(path: string, params?: object, options?: IHttpServiceRequestOptions): Promise<IHttpServiceResponse<T>> {
    return this._client.get<T>(path, params, options);
  }

  public async post<T = any>(path: string, data?: object, options?: IHttpServiceRequestOptions): Promise<IHttpServiceResponse<T>> {
    return this._client.post<T>(path, data, options);
  }

  public async put<T = any>(path: string, data?: object, options?: IHttpServiceRequestOptions): Promise<IHttpServiceResponse<T>> {
    return this._client.put<T>(path, data, options);
  }

  public async delete<T = any>(path: string, options?: IHttpServiceRequestOptions): Promise<IHttpServiceResponse<T>> {
    return this._client.delete<T>(path, options);
  }

  public async patch<T = any>(path: string, data?: object, options?: IHttpServiceRequestOptions): Promise<IHttpServiceResponse<T>> {
    return this._client.patch<T>(path, data, options);
  }

  public createCancelToken(): AbortController {
    return this._client.createCancelToken();
  }

  public use(middleware: IHttpMiddleware): void {
    this._client.use(middleware);
  }
}
