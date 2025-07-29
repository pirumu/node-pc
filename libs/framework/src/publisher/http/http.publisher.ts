import axios, { AxiosInstance } from 'axios';

import { IPublisher } from '../publisher.types';

import { HTTPPublishConfigOptions, HTTPPublishRequestOptions } from './http.types';

export class HTTPPublisher implements IPublisher {
  private readonly _httpClient: AxiosInstance;
  constructor(options: HTTPPublishConfigOptions) {
    this._httpClient = axios.create(options);
  }

  public async publish<T extends HTTPPublishRequestOptions = HTTPPublishRequestOptions>(
    channel: string,
    data: Record<string, unknown>,
    options?: T,
  ): Promise<any> {
    // Build headers
    const headers = {
      ['Content-Type']: 'application/json',
      ...(options?.headers || {}),
    };

    if (options?.auth) {
      this._addAuthHeaders(headers, options.auth);
    }

    const requestConfig = {
      method: options?.method ?? 'POST',
      path: channel ?? options?.path ?? '',
      headers,
      data,
      timeout: options?.timeout,
    };

    try {
      return this._httpClient.request(requestConfig);
    } catch (error) {
      if (options?.retries && options?.retries > 0) {
        return this._retryPublish(channel, data, {
          ...options,
          retries: options.retries - 1,
        });
      }
      throw error;
    }
  }

  private _addAuthHeaders(headers: Record<string, string>, auth: HTTPPublishRequestOptions['auth']): void {
    if (!auth) {
      return;
    }

    switch (auth.type) {
      case 'bearer':
        if (auth.token) {
          headers['Authorization'] = `Bearer ${auth.token}`;
        }
        break;
      case 'basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      case 'apikey':
        if (auth.apiKey) {
          headers['X-API-Key'] = auth.apiKey;
        }
        break;
    }
  }

  private validateResponse(response: any): void {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async _retryPublish(channel: string, data: Record<string, unknown>, options: HTTPPublishRequestOptions): Promise<void> {
    const delay = Math.pow(2, options.retries ?? 0) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return this.publish(channel, data, options);
  }
}
