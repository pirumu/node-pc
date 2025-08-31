import { PartialProperties } from '@framework/types';
import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { ClusterEntity } from './cluster.entity';
import { SiteEntity } from './site.entity';

@Entity({ collection: 'tablets' })
export class TabletEntity extends AbstractEntity {
  @Property({ unique: true })
  clientId!: string;

  @Property()
  publicKey!: string;

  @ManyToOne(() => ClusterEntity, { fieldName: 'clusterId', ref: true })
  cluster!: Ref<ClusterEntity>;

  @ManyToOne(() => SiteEntity, { fieldName: 'siteId', ref: true })
  site!: Ref<SiteEntity>;

  @Property({ default: false })
  isMfaEnabled = false;

  constructor(data?: PartialProperties<TabletEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }
}
