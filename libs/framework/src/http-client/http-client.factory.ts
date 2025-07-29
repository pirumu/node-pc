import { FetchHttpClient } from './fetch/fetch-http.client';
import { HttpClientType } from './http-client.constants';
import { IHttpClient, IHttpServiceOptions } from './http-client.interfaces';

export class HttpClientFactory {
  static create(type: HttpClientType, options: IHttpServiceOptions): IHttpClient {
    switch (type) {
      case HttpClientType.FETCH:
        return new FetchHttpClient(options);
      //Add more client.
      default:
        throw new Error(`Unsupported HTTP client type: ${type}`);
    }
  }
}
