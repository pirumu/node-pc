import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export class ItemEntity extends BaseEntity {
  name: string;
  partNo: string;
  materialNo: string;
  itemTypeId: string;
  type: string;
  image?: string;
  description?: string;

  constructor(props: Properties<ItemEntity>) {
    super();
    Object.assign(this, props);
  }
}

export class IssueItemEntity extends ItemEntity {
  locations: string[];
  totalQuantity: number;
  totalCalcQuantity: number;
  binId: string;
  dueDate: string;

  constructor(props: Properties<IssueItemEntity>) {
    super(props);
    Object.assign(this, props);
  }
}
