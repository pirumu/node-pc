// import { CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
//
// export const ROLES_KEY = 'roles';
// export const RequireRoles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
//
// export const PERMISSIONS_KEY = 'permissions';
// export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
//
// export class RolesGuard implements CanActivate {
//   constructor(private readonly _reflector: Reflector) {}
//
//   public canActivate(context: ExecutionContext): boolean {
//     const requiredRoles = this._reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
//     if (!requiredRoles) {
//       return true;
//     }
//
//     const request = context.switchToHttp().getRequest();
//     const user = request.user;
//     return requiredRoles.includes(user?.userRole);
//   }
// }
