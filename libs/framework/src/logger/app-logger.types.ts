import { TRACING_ID, VERSION_KEY } from '../constants';

export type LogFormat = {
  res?: any;
  context?: string;
  error?: any;
  tracing_id?: string;
  response_time?: string;
  msg?: string;
} & Record<string, any>;

export type RequestHeaders = {
  [TRACING_ID]?: string;
  [VERSION_KEY]?: string;
} & Record<string, any>;

export type SerializedRequest = {
  method: string;
  url: string;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: RequestHeaders;
};

export type SerializedResponse = {
  statusCode: number;
};
