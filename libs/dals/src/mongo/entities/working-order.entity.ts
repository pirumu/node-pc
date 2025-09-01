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

  @Property({ nullable: true })
  wo: string | null;

  @Property({ nullable: true })
  vehicleNum: string | null;

  @Property({ nullable: true })
  vehicleType: string | null;

  @Property({ nullable: true })
  platform: string | null;

  @ManyToOne(() => SiteEntity, { fieldName: 'siteId', ref: true })
  site!: Ref<SiteEntity>;

  constructor(data?: PartialProperties<WorkingOrderEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }
}
