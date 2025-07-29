import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export class AreaEntity extends BaseEntity {
  name: string;
  torque: number;

  constructor(props: Properties<AreaEntity>) {
    super();
    Object.assign(this, props);
  }
}
