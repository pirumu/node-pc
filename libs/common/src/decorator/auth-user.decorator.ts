import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export const AuthUser = createParamDecorator((required = true, ctx: ExecutionContext) => {
  const request: Request = ctx.switchToHttp().getRequest();
  if (!request.user && required) {
    throw new UnauthorizedException(required);
  }
  return request.user;
});
