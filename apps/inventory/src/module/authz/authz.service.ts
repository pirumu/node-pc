import { Permission, Role, UserEntity } from '@entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthzService {
  public hasPermission(role: Role, permission: Permission): boolean {
    return UserEntity.hasPermission(role, permission);
  }

  public canAssign(from: Role, to: Role): boolean {
    return UserEntity.getAssignableRoles(from).includes(to);
  }

  public canRegister(from: Role, to: Role): boolean {
    return UserEntity.getRegisterableRoles(from).includes(to);
  }
}
