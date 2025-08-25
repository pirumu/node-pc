import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne, Ref } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { SystemEntity } from './system.entity';

@Entity({ collection: 'sites' })
export class SiteEntity extends AbstractEntity {
  @Property()
  name: string;

  @Property({ unique: true })
  accessKey: string;

  @Property()
  status: string;

  @ManyToOne(() => SystemEntity, { fieldName: 'systemId', ref: true })
  system!: Ref<SystemEntity>;

  constructor(data?: PartialProperties<SiteEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
