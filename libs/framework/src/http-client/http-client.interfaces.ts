/** biome-ignore-all lint/suspicious/noExplicitAny: true */
import { HttpClientType } from './http-client.constants';

export interface IHttpServiceResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

export interface IHttpServiceRequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  baseURL?: string;
  params?: Record<string, any>;
  [key: string]: any;
}

export interface IHttpServiceOptions {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  version?: string;
  retries?: number;
  retryDelay?: number;
}

export interface IHttpMiddleware {
  onRequest?(config: IHttpServiceRequestOptions): Promise<IHttpServiceRequestOptions> | IHttpServiceRequestOptions;
  onResponse?<T>(response: IHttpServiceResponse<T>): Promise<IHttpServiceResponse<T>> | IHttpServiceResponse<T>;
  onError?(error: any): Promise<any> | any;
}

export interface IHttpClient {
  get<T = any>(path: string, params?: object, options?: IHttpServiceRequestOptions): Promise<IHttpServiceResponse<T>>;
  post<T = any>(path: string, data?: object | string, options?: IHttpServiceRequestOptions): Promise<IHttpServiceResponse<T>>;
  put<T = any>(path: string, data?: object | string, options?: IHttpServiceRequestOptions): Promise<IHttpServiceResponse<T>>;
  delete<T = any>(path: string, options?: IHttpServiceRequestOptions): Promise<IHttpServiceResponse<T>>;
  patch<T = any>(path: string, data?: object | string, options?: IHttpServiceRequestOptions): Promise<IHttpServiceResponse<T>>;

  use(middleware: IHttpMiddleware): void;

  createCancelToken(): AbortController;
}

export type HttpModuleOptions = {
  clientType: HttpClientType;
  clientOptions: IHttpServiceOptions;
};
