import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne, Unique, Embeddable, Embedded } from '@mikro-orm/core';
import { ObjectId, Ref } from '@mikro-orm/mongodb';

import { AbstractEntity } from './abstract.entity';
import { ItemEntity } from './item.entity';
import { UserEntity } from './user.entity';

@Embeddable()
export class IssuedItemLocation {
  @Property()
  binId!: ObjectId;

  @Property()
  loadcellId!: ObjectId;

  @Property()
  quantity!: number;
}

@Entity({ collection: 'issue_histories' })
@Unique({ properties: ['user._id', 'item._id'] })
export class IssueHistoryEntity extends AbstractEntity {
  @ManyToOne(() => UserEntity, { fieldName: 'userId', ref: true })
  user!: Ref<UserEntity>;

  @ManyToOne(() => ItemEntity, { fieldName: 'itemId', ref: true })
  item!: Ref<ItemEntity>;

  @Property()
  totalIssuedQuantity!: number;

  @Embedded(() => IssuedItemLocation, { default: [] })
  locations: IssuedItemLocation[] = [];

  constructor(data?: PartialProperties<IssueHistoryEntity>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }
}
