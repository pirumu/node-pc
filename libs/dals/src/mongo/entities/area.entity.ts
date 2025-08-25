import { PartialProperties } from '@framework/types';
import { Entity, Property } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';

@Entity({ collection: 'areas' })
export class AreaEntity extends AbstractEntity {
  @Property()
  name!: string;

  @Property()
  torque!: number;

  constructor(data?: PartialProperties<AreaEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
