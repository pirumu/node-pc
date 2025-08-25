import { CLIENT_ID_KEY } from '@common/constants';
import { AppHttpException } from '@framework/exception';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const TabletDeviceId = createParamDecorator((required = true, ctx: ExecutionContext) => {
  const request: Request = ctx.switchToHttp().getRequest();
  if (!request.headers[CLIENT_ID_KEY] && required) {
    throw AppHttpException.unauthorized({ message: `Required header ${CLIENT_ID_KEY}` });
  }
  return request.user;
});
