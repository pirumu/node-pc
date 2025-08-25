import { LoadcellEntity } from '@dals/mongo/entities';
import { PartialProperties } from '@framework/types';
import { Entity, Property, Enum, Collection, OneToMany } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';

export const PORT_STATUS = {
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
} as const;

export type PortStatus = (typeof PORT_STATUS)[keyof typeof PORT_STATUS];

@Entity({ collection: 'ports' })
export class PortEntity extends AbstractEntity {
  @Property()
  name!: string;

  @Property()
  path!: string;

  @Property({ nullable: true })
  heartbeat?: number;

  @Enum({ items: () => PORT_STATUS })
  status!: PortStatus;

  @OneToMany(() => LoadcellEntity, (e) => e.port, {
    persist: false,
  })
  loadcells = new Collection<LoadcellEntity>(this);

  constructor(data?: PartialProperties<PortEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
