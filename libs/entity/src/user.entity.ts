import { BaseEntity, Properties } from './base.entity';

export enum Role {
  USER = 'user',
  OPERATOR = 'operator',
  SITE_ADMIN = 'site_admin',
  MASTER_ADMIN = 'master_admin',
  ADMINISTRATOR = 'administrator',
}

export enum Permission {
  CREATE_CARD = 'create_card',
  SETUP_READER = 'setup_reader',
  ASSIGN_USER = 'assign_user',
  REGISTER_USER = 'register_user',
}

export const ROLE_AS_VALUE: Record<Role, number> = {
  [Role.USER]: 0,
  [Role.OPERATOR]: 4,
  [Role.SITE_ADMIN]: 3,
  [Role.MASTER_ADMIN]: 2,
  [Role.ADMINISTRATOR]: 1,
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMINISTRATOR]: [Permission.CREATE_CARD, Permission.SETUP_READER, Permission.ASSIGN_USER, Permission.REGISTER_USER],
  [Role.MASTER_ADMIN]: [Permission.CREATE_CARD, Permission.SETUP_READER, Permission.ASSIGN_USER, Permission.REGISTER_USER],
  [Role.SITE_ADMIN]: [Permission.CREATE_CARD, Permission.SETUP_READER, Permission.ASSIGN_USER, Permission.REGISTER_USER],
  [Role.OPERATOR]: [Permission.REGISTER_USER],
  [Role.USER]: [],
};

export const ASSIGNABLE_ROLES: Record<Role, Role[]> = {
  [Role.ADMINISTRATOR]: [Role.MASTER_ADMIN, Role.SITE_ADMIN, Role.OPERATOR],
  [Role.MASTER_ADMIN]: [Role.SITE_ADMIN, Role.OPERATOR],
  [Role.SITE_ADMIN]: [Role.OPERATOR],
  [Role.OPERATOR]: [],
  [Role.USER]: [],
};

export const REGISTERABLE_ROLES: Record<Role, Role[]> = {
  [Role.ADMINISTRATOR]: [Role.ADMINISTRATOR, Role.MASTER_ADMIN, Role.SITE_ADMIN, Role.OPERATOR, Role.USER],
  [Role.MASTER_ADMIN]: [Role.SITE_ADMIN, Role.OPERATOR, Role.USER],
  [Role.SITE_ADMIN]: [Role.OPERATOR, Role.USER],
  [Role.OPERATOR]: [],
  [Role.USER]: [],
};

export type UserCloudInfo = {
  id: string;
  isSync: boolean;
  retryCount: number;
};

export class UserEntity extends BaseEntity {
  loginId: string;
  password: string;
  pinCode?: string;
  role: Role;
  employeeId: string;
  cardNumber: string;

  twoFactorEnabled?: boolean;
  genealogy: string | null;
  cloud: UserCloudInfo;

  constructor(props: Properties<UserEntity>) {
    super();
    Object.assign(this, props);
  }

  public isEnableTwoFactorAuthentication(): boolean {
    return !!this.twoFactorEnabled;
  }

  public pin(): string {
    return this.pinCode || '';
  }

  public static hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
  }

  public static getAssignableRoles(role: Role): Role[] {
    return ASSIGNABLE_ROLES[role] ?? [];
  }

  public static getRegisterableRoles(role: Role): Role[] {
    return REGISTERABLE_ROLES[role] ?? [];
  }
}
