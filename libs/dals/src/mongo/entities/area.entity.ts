import { PartialProperties } from '@framework/types';
import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { SiteEntity } from './site.entity';

@Entity({ collection: 'areas' })
export class AreaEntity extends AbstractEntity {
  @Property()
  name!: string;

  @Property()
  torque!: number;

  @ManyToOne(() => SiteEntity, { ref: true, fieldName: 'siteId' })
  site!: Ref<SiteEntity>;

  constructor(data?: PartialProperties<AreaEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }
}
