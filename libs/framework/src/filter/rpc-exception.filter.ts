import { Catch, RpcExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Request } from 'express';
import { Observable, throwError } from 'rxjs';

@Catch(RpcException)
export class GlobalRpcExceptionFilter implements RpcExceptionFilter<RpcException> {
  constructor(public readonly isDebug: boolean) {}

  public catch(exception: RpcException, host: ArgumentsHost): Observable<any> {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    return throwError(() => ({
      success: false,
      code: 500,
      internal: '500000',
      message: 'Internal Server Error',
      data: null,
      timestamp: new Date().toISOString(),
      path: request.url,
      stack: this.isDebug ? (exception instanceof Error ? exception.stack : exception) : null,
    }));
  }
}
