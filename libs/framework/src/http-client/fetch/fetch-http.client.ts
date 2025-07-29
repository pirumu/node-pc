import { HttpClientException } from '@framework/http-client/http-client.exception';

import { sleep } from '../../time/sleep';
import { AbstractHttpClient } from '../abstract-http.client';
import { IHttpServiceRequestOptions, IHttpServiceResponse } from '../http-client.interfaces';

export class FetchHttpClient extends AbstractHttpClient {
  protected async executeRequest<T>(
    method: string,
    path: string,
    data?: object | string,
    options: IHttpServiceRequestOptions = {},
  ): Promise<IHttpServiceResponse<T>> {
    const url = this._buildUrl(path, options);
    const config = this._buildFetchConfig(method, data, options);

    try {
      const response = await this._fetchWithRetry(url, config);
      return await this._parseFetchResponse<T>(response);
    } catch (error) {
      throw this._handleFetchError(error);
    }
  }

  private _buildUrl(path: string, options: IHttpServiceRequestOptions): string {
    const baseURL = options.baseURL || this.options.baseURL || '';
    const url = new URL(path, baseURL);

    // Add query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private _buildFetchConfig(method: string, data?: object | string, options: IHttpServiceRequestOptions = {}): RequestInit {
    const config: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        ['Content-Type']: 'application/json',
        ...options.headers,
      },
      signal: options.signal,
    };

    if (data && !['GET', 'HEAD'].includes(method.toUpperCase())) {
      config.body = typeof data === 'object' ? JSON.stringify(data) : data;
    }

    return config;
  }

  private async _fetchWithRetry(url: string, config: RequestInit, retryCount = 0): Promise<Response> {
    try {
      const response = await fetch(url, config);

      if (!response.ok && this._shouldRetry(response.status) && retryCount < (this.options.retries || 0)) {
        await sleep(this.options.retryDelay || 1000);
        return this._fetchWithRetry(url, config, retryCount + 1);
      }

      return response;
    } catch (error) {
      if (retryCount < (this.options.retries || 0)) {
        await sleep(this.options.retryDelay || 1000);
        return this._fetchWithRetry(url, config, retryCount + 1);
      }
      throw error;
    }
  }

  private _shouldRetry(status: number): boolean {
    return status >= 500 || status === 429;
  }

  private async _parseFetchResponse<T>(response: Response): Promise<IHttpServiceResponse<T>> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let data: T;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = (await response.text()) as unknown as T;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      data,
    };
  }

  private _handleFetchError(error: Error): Error {
    if (error.name === 'AbortError') {
      return new HttpClientException('Request was cancelled:' + error.message, error.cause, error.stack);
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new HttpClientException('Network error occurred' + error.message, error.cause, error.stack);
    }

    return error;
  }
}
