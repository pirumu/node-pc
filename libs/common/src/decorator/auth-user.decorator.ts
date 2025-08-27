import { AppHttpException } from '@framework/exception';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const AuthUser = createParamDecorator((required = true, ctx: ExecutionContext) => {
  const request: Request = ctx.switchToHttp().getRequest();
  if (!request.user && required) {
    throw AppHttpException.unauthorized();
  }
  return request.user;
});
