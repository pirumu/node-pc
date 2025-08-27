import { ClusterEntity } from '@dals/mongo/entities/cluster.entity';
import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne, Ref, OneToMany, Collection } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { SystemEntity } from './system.entity';

@Entity({ collection: 'sites' })
export class SiteEntity extends AbstractEntity {
  @Property()
  name: string;

  @Property({ unique: true, hidden: true })
  accessKey: string;

  @Property()
  status: string;

  @ManyToOne(() => SystemEntity, { fieldName: 'systemId', ref: true })
  system!: Ref<SystemEntity>;

  @OneToMany(() => ClusterEntity, (e) => e.site, { persist: false })
  clusters = new Collection<ClusterEntity>(this);

  constructor(data?: PartialProperties<SiteEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
