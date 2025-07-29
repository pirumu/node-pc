import { SnowflakeId } from '@framework/snowflake';
import { Logger } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';

import { TRACING_ID } from '../constants';

import {
  IHttpClient,
  IHttpMiddleware,
  IHttpServiceOptions,
  IHttpServiceRequestOptions,
  IHttpServiceResponse,
} from './http-client.interfaces';

export abstract class AbstractHttpClient implements IHttpClient {
  protected middlewares: IHttpMiddleware[] = [];
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly options: IHttpServiceOptions) {
    this.options.headers = this.options.headers || {};

    if (this.options.version) {
      this.options.headers[TRACING_ID] = this.options.version;
    }
  }

  protected abstract executeRequest<T>(
    method: string,
    path: string,
    data?: object | string,
    options?: IHttpServiceRequestOptions,
  ): Promise<IHttpServiceResponse<T>>;

  // Public API methods
  public async get<T = any>(path: string, params: object = {}, options: IHttpServiceRequestOptions = {}): Promise<IHttpServiceResponse<T>> {
    const mergedOptions = { ...options, params };
    return this.request<T>('GET', path, undefined, mergedOptions);
  }

  public async post<T = any>(
    path: string,
    data: object | string = {},
    options: IHttpServiceRequestOptions = {},
  ): Promise<IHttpServiceResponse<T>> {
    return this.request<T>('POST', path, data, options);
  }

  public async put<T = any>(
    path: string,
    data: object | string = {},
    options: IHttpServiceRequestOptions = {},
  ): Promise<IHttpServiceResponse<T>> {
    return this.request<T>('PUT', path, data, options);
  }

  public async delete<T = any>(path: string, options: IHttpServiceRequestOptions = {}): Promise<IHttpServiceResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  public async patch<T = any>(
    path: string,
    data: object | string = {},
    options: IHttpServiceRequestOptions = {},
  ): Promise<IHttpServiceResponse<T>> {
    return this.request<T>('PATCH', path, data, options);
  }

  public use(middleware: IHttpMiddleware): void {
    this.middlewares.push(middleware);
  }

  public createCancelToken(): AbortController {
    return new AbortController();
  }

  protected async request<T>(
    method: string,
    path: string,
    data?: object | string,
    options: IHttpServiceRequestOptions = {},
  ): Promise<IHttpServiceResponse<T>> {
    try {
      const processedOptions = await this.applyRequestMiddlewares(this.buildRequestConfig(options));

      this.logger.log(`[HTTP] ${JSON.stringify({ method, path })}`);

      let response = await this.executeRequest<T>(method, path, data, processedOptions);
      response = await this.applyResponseMiddlewares(response);
      return response;
    } catch (error) {
      throw await this.applyErrorMiddlewares(error);
    }
  }

  protected buildRequestConfig(options: IHttpServiceRequestOptions): IHttpServiceRequestOptions {
    const extraHeaders = {
      headers: {
        [TRACING_ID]: ClsServiceManager.getClsService()?.getId() ?? new SnowflakeId().id(),
      },
    };

    return {
      ...this.options,
      ...extraHeaders,
      ...options,
    };
  }

  protected async applyRequestMiddlewares(config: IHttpServiceRequestOptions): Promise<IHttpServiceRequestOptions> {
    let processedConfig = config;

    for (const middleware of this.middlewares) {
      if (middleware.onRequest) {
        processedConfig = await middleware.onRequest(processedConfig);
      }
    }

    return processedConfig;
  }

  protected async applyResponseMiddlewares<T>(response: IHttpServiceResponse<T>): Promise<IHttpServiceResponse<T>> {
    let processedResponse = response;

    for (const middleware of this.middlewares) {
      if (middleware.onResponse) {
        processedResponse = await middleware.onResponse(processedResponse);
      }
    }

    return processedResponse;
  }

  protected async applyErrorMiddlewares(error: Error): Promise<any> {
    let processedError = error;

    for (const middleware of this.middlewares) {
      if (middleware.onError) {
        processedError = await middleware.onError(processedError);
      }
    }

    return processedError;
  }
}
