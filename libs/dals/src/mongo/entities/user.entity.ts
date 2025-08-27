import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne, ManyToMany, Collection, Ref } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
// eslint-disable-next-line import/no-cycle
import { DepartmentEntity } from './department.entity';
import { RoleEntity } from './role.entity';
import { SiteEntity } from './site.entity';

@Entity({ collection: 'users' })
export class UserEntity extends AbstractEntity {
  @Property({ index: true, unique: true })
  username!: string;

  @Property()
  firstName!: string;

  @Property()
  lastName!: string;

  @Property({ default: '' })
  phone: string = '';

  @Property({ default: '' })
  address: string = '';

  @Property({ default: '' })
  avatar: string = '';

  @Property({ unique: true })
  email!: string;

  @Property({ nullable: true })
  emailVerifiedAt?: Date;

  @Property({ default: '' })
  cardId: string = '';

  @Property({ default: '', hidden: true })
  pin: string = '';

  @Property({ default: '' })
  employeeId: string = '';

  @Property({ nullable: true })
  status?: string;

  @Property({ hidden: true })
  password!: string;

  @Property({ default: [] })
  permissions: string[] = [];

  @ManyToOne(() => RoleEntity, {
    referenceColumnName: 'key',
    fieldName: 'roleKey',
    serializedName: 'roleKey',
  })
  role!: Ref<RoleEntity>;

  @ManyToOne(() => DepartmentEntity, {
    fieldName: 'departmentId',
    ref: true,
  })
  department!: Ref<DepartmentEntity>;

  @ManyToMany(() => SiteEntity, undefined, {
    fieldName: 'siteIds',
  })
  sites = new Collection<SiteEntity>(this);

  @Property({ persist: false })
  public get fullname(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  constructor(data?: PartialProperties<UserEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
