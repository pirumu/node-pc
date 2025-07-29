import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

type SuccessResponseServer = {
  success: boolean;
  data?: object | Array<any>;
};

@Injectable()
export class HandleResponseInterceptor<T> implements NestInterceptor<T, SuccessResponseServer> {
  public intercept(_context: ExecutionContext, next: CallHandler): Observable<SuccessResponseServer> {
    return next.handle().pipe(
      map((data) => {
        const successResponse: SuccessResponseServer = {
          success: true,
          data,
        };
        return successResponse;
      }),
    );
  }
}
