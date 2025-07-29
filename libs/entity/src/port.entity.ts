import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export class PortEntity extends BaseEntity {
  name: string;
  path: string;
  heartbeat?: number;
  status: string;

  constructor(props: Properties<PortEntity>) {
    super();
    Object.assign(this, props);
  }
}
