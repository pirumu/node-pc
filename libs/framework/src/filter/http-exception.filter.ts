import { AppHttpException } from '@framework/exception';
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(public readonly isDebug: boolean) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorResponse: any;
    console.log(exception);
    if (exception instanceof AppHttpException) {
      status = exception.getStatus();
      errorResponse = {
        success: false,
        code: status,
        internal: exception.internal,
        message: exception.message,
        data: exception.data || null,
        timestamp: new Date().toISOString(),
        path: request.url,
        stack: this.isDebug ? exception.stack : null,
      };
    } else {
      // Handle unexpected errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        success: false,
        code: 500,
        internal: '500000',
        message: 'Internal Server Error',
        data: JSON.parse(JSON.stringify(exception)),
        timestamp: new Date().toISOString(),
        path: request.url,
        stack: this.isDebug ? (exception instanceof Error ? exception.stack : exception) : null,
      };
    }

    response.status(status).json(errorResponse);
  }
}
