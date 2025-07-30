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

export class IssueItemEntity extends BaseEntity {
  name: any;
  partNo: any;
  materialNo: any;
  itemTypeId: any;
  type: any;
  image: any;
  description: any;
  locations: any;
  totalQuantity: any;
  totalCalcQuantity: any;
  binId: any;
  dueDate: any;

  constructor(props: Properties<ItemEntity>) {
    super();
    Object.assign(this, props);
  }
}
