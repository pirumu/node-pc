import { Entity, Property, Enum } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { PartialProperties } from '@framework/types';

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  ADMIN_SUPPORT: 'ADMIN_SUPPORT',
  SUPERVISOR: 'SUPERVISOR',
  REPLENISHER: 'REPLENISHER',
  STAFF: 'STAFF',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

@Entity({ collection: 'roles' })
export class RoleEntity extends AbstractEntity {
  @Property()
  name!: string;

  @Enum(() => ROLES)
  @Property({ unique: true })
  key!: RoleKey;

  @Property({ nullable: true })
  status?: string;

  @Property({ default: [] })
  permissions: string[] = [];

  @Property({ default: [] })
  ownerKeys: RoleKey[] = [];

  constructor(data?: PartialProperties<RoleEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }
}
