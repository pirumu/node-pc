import { PartialProperties } from '@framework/types';
import { Entity, Property, Enum, ManyToOne, Ref } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { ClusterEntity } from './cluster.entity';
import { SiteEntity } from './site.entity';

export const CABINET_TYPE = {
  MAIN: 'MAIN',
  SUB: 'SUB',
} as const;

export type CabinetType = (typeof CABINET_TYPE)[keyof typeof CABINET_TYPE];

@Entity({ collection: 'cabinets' })
export class CabinetEntity extends AbstractEntity {
  @ManyToOne(() => SiteEntity, { ref: true, fieldName: 'siteId' })
  site!: Ref<SiteEntity>;

  @ManyToOne(() => ClusterEntity, { ref: true, fieldName: 'clusterId' })
  cluster!: Ref<ClusterEntity>;

  @Property()
  name: string;

  @Property()
  rowNumber: number;

  @Property()
  binNumber: number;

  @Enum({ items: () => CABINET_TYPE, default: CABINET_TYPE.MAIN })
  type: CabinetType = CABINET_TYPE.MAIN;

  @Property({ nullable: true })
  binType?: string;

  @Property({ default: 1 })
  loadcellPerBin: number = 1;

  constructor(data?: PartialProperties<CabinetEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }
}
