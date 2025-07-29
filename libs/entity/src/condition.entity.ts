import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export class ConditionEntity extends BaseEntity {
  condition: string;
  description: string;

  constructor(props: Properties<ConditionEntity>) {
    super();
    Object.assign(this, props);
  }
}
