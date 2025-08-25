import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne, Ref } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { SiteEntity } from './site.entity';

export const ITEM_TYPE_CATEGORY = {
  CONSUMABLE: 'CONSUMABLE',
  DURABLE: 'DURABLE',
  TORQUE_RWENCH: 'TORQUE_RWENCH',
} as const;

export type ItemTypeCategoryType = (typeof ITEM_TYPE_CATEGORY)[keyof typeof ITEM_TYPE_CATEGORY];

@Entity({ collection: 'item_types' })
export class ItemTypeEntity extends AbstractEntity {
  @Property()
  name!: string;

  @Property({ default: '' })
  description: string = '';

  @Property({ type: 'string', default: ITEM_TYPE_CATEGORY.CONSUMABLE })
  category!: ItemTypeCategoryType;

  @ManyToOne(() => SiteEntity, {
    fieldName: 'siteId',
    ref: true,
  })
  site: Ref<SiteEntity>;

  constructor(data?: PartialProperties<ItemTypeEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
