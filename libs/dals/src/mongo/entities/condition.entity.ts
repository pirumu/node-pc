import { CONDITION_TYPE } from '@common/constants';
import { SiteEntity } from '@dals/mongo/entities/site.entity';
import { PartialProperties } from '@framework/types';
import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';

@Entity({ collection: 'conditions' })
export class ConditionEntity extends AbstractEntity {
  @ManyToOne(() => SiteEntity, { fieldName: 'siteId', ref: true })
  site!: Ref<SiteEntity>;

  @Property({ type: 'string', default: CONDITION_TYPE.WORKING })
  name!: CONDITION_TYPE;

  @Property()
  isSystemType: boolean = false;

  @Property({ nullable: true })
  description?: string;

  constructor(data?: PartialProperties<ConditionEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }
}
