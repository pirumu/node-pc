import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@entity';

export const AuthUserRole = createParamDecorator((data: unknown, ctx: ExecutionContext): Role => {
  const request = ctx.switchToHttp().getRequest();
  return request.user?.userRole;
});
