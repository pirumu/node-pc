import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne, Ref } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { SiteEntity } from './site.entity';

@Entity({ collection: 'clusters' })
export class ClusterEntity extends AbstractEntity {
  @ManyToOne(() => SiteEntity, { fieldName: 'siteId', ref: true })
  site!: Ref<SiteEntity>;

  @Property()
  name: string;

  @Property({ default: '' })
  code: string = '';

  @Property({ default: false })
  isRFID: boolean = false;

  @Property({ default: false })
  isVirtual: boolean = false;

  @Property({ default: false })
  isOnline: boolean = false;

  constructor(data?: PartialProperties<ClusterEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
