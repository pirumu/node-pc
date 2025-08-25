import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne, Enum, Ref, OneToOne } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { SiteEntity } from './site.entity';
// eslint-disable-next-line import/no-cycle
import { UserEntity } from './user.entity';

export const DEPARTMENT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type DepartmentStatus = (typeof DEPARTMENT_STATUS)[keyof typeof DEPARTMENT_STATUS];

@Entity({ collection: 'departments' })
export class DepartmentEntity extends AbstractEntity {
  @Property()
  name!: string;

  @Property({ default: '' })
  description: string = '';

  @Property({ type: 'string', default: DEPARTMENT_STATUS.ACTIVE })
  status: DepartmentStatus = DEPARTMENT_STATUS.ACTIVE;

  @ManyToOne(() => SiteEntity, { fieldName: 'siteId', ref: true })
  site!: Ref<SiteEntity>;

  @OneToOne(() => UserEntity, {
    fieldName: 'ownerId',
    nullable: true,
    ref: true,
  })
  owner: Ref<UserEntity> | null;

  constructor(data?: PartialProperties<DepartmentEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
