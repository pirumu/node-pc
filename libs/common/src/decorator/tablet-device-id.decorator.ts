import { AppHttpException } from '@framework/exception';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { DEVICE_ID_KEY } from '../constants';

export const TabletDeviceId = createParamDecorator((required = true, ctx: ExecutionContext) => {
  const request: Request = ctx.switchToHttp().getRequest();
  if (!request.headers[DEVICE_ID_KEY] && required) {
    throw AppHttpException.unauthorized({ message: `Required header ${DEVICE_ID_KEY}` });
  }
  return request.user;
});
