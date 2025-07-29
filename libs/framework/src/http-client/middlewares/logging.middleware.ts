/** biome-ignore-all lint/suspicious/noExplicitAny: true */
import { Logger } from '@nestjs/common';

import { IHttpMiddleware, IHttpServiceRequestOptions, IHttpServiceResponse } from '../http-client.interfaces';

export class LoggingMiddleware implements IHttpMiddleware {
  constructor(private logger: Logger) {}

  onRequest(config: IHttpServiceRequestOptions): IHttpServiceRequestOptions {
    this.logger.debug(`[Request] ${JSON.stringify(config)}`);
    return config;
  }

  onResponse<T>(response: IHttpServiceResponse<T>): IHttpServiceResponse<T> {
    this.logger.debug(`[Response] Status: ${response.status}`);
    return response;
  }

  onError(error: any): any {
    this.logger.error(`[Error] ${error.message}`);
    return error;
  }
}
