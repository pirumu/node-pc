import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne, Ref } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { SiteEntity } from './site.entity';

@Entity({ collection: 'working_orders' })
export class WorkingOrderEntity extends AbstractEntity {
  @Property()
  code!: string;

  @Property({ nullable: true })
  description?: string;

  @ManyToOne(() => SiteEntity, { fieldName: 'siteId', ref: true })
  site!: Ref<SiteEntity>;

  constructor(data?: PartialProperties<WorkingOrderEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
