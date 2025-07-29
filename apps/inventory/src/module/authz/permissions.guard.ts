import { Permission, Role, UserEntity } from '@entity';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { PERMISSIONS_KEY } from './role.guard';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly _reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this._reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions) {
      return true;
    }

    const request: Request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const role: Role = user.role;

    return requiredPermissions.every((permission) => UserEntity.hasPermission(role, permission));
  }
}
