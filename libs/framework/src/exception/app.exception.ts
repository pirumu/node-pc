/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { HttpException } from '@nestjs/common';

export type ErrorResponse = {
  code: number;
  internal: string;
  message: string;
};

export type ErrorWithData = ErrorResponse & {
  data?: any;
};

export type ErrorData = Pick<ErrorWithData, 'message' | 'data'>;

export const CommonErrors = {
  Unauthorized: (msg?: string) => ({
    code: 401,
    internal: '401000',
    message: msg ? 'Unauthorized: ' + msg : 'Unauthorized',
  }),
  Forbidden: (msg?: string) => ({
    code: 403,
    internal: '403000',
    message: msg ? 'Forbidden: ' + msg : 'Forbidden',
  }),
  BadRequest: (msg?: string) => ({
    code: 400,
    internal: '400000',
    message: msg ? 'Bad Request: ' + msg : 'Bad Request',
  }),
  InternalServerError: (msg?: string) => ({
    code: 500,
    internal: '500000',
    message: msg ? 'Internal Server Error: ' + msg : 'Internal Server Error',
  }),
} as const;

export class AppHttpException extends HttpException {
  public readonly internal: string;
  public readonly data?: any;

  constructor(error: ErrorResponse | ErrorWithData, data?: any) {
    const { code, message, internal } = error;
    super(message, code);
    this.internal = internal;
    this.data = (error as ErrorWithData).data || data;
    this.name = AppHttpException.name;
  }

  public static unauthorized(info?: ErrorData): AppHttpException {
    return new AppHttpException(CommonErrors.Unauthorized(info?.message), info?.data);
  }

  public static forbidden(info?: ErrorData): AppHttpException {
    return new AppHttpException(CommonErrors.Unauthorized(info?.message), info?.data);
  }

  public static badRequest(info?: ErrorData): AppHttpException {
    return new AppHttpException(CommonErrors.BadRequest(info?.message), info?.data);
  }

  public static internalServerError(info?: ErrorData): AppHttpException {
    return new AppHttpException(CommonErrors.InternalServerError(info?.message), info?.data);
  }
}
