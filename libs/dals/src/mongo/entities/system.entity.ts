import { PartialProperties } from '@framework/types';
import { Entity, Property } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';

@Entity({ collection: 'systems' })
export class SystemEntity extends AbstractEntity {
  @Property()
  name!: string;

  @Property()
  status!: string;

  constructor(data?: PartialProperties<SystemEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
