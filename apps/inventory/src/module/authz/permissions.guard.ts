import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly _reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    return true;
  }
}
