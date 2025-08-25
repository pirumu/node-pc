import { PartialProperties } from '@framework/types';
import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { UserEntity } from './user.entity';

@Entity({ collection: 'facial_recognitions' })
export class FacialRecognitionEntity extends AbstractEntity {
  @ManyToOne(() => UserEntity, {
    fieldName: 'userId',
    ref: true,
  })
  user!: Ref<UserEntity>;

  @Property()
  data: string;

  @Property()
  hik: string;

  constructor(data?: PartialProperties<FacialRecognitionEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
