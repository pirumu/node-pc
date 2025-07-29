import { AxiosRequestConfig } from 'axios';

import { BasePublishOptions } from '../publisher.types';

export type HTTPPublishConfigOptions = AxiosRequestConfig;

export interface HTTPPublishRequestOptions extends BasePublishOptions {
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
  };
  path?: string;
  responseValidation?: boolean;
}
