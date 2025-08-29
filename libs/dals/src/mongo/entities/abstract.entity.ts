import { PrimaryKey, SerializedPrimaryKey, Property, BaseEntity, Embedded } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

import { Synchronization } from './sync-info.entity';

export abstract class AbstractEntity extends BaseEntity {
  @PrimaryKey()
  _id: ObjectId;

  @SerializedPrimaryKey()
  id: string;

  @Property({ nullable: true })
  createdBy?: ObjectId;

  @Property({ nullable: true })
  updatedBy?: ObjectId;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date(), nullable: true })
  updatedAt?: Date;

  @Embedded(() => Synchronization, { object: true })
  synchronization: Synchronization = new Synchronization();

  protected constructor() {
    super();
    this._id = new ObjectId();
    this.synchronization = new Synchronization();
  }
}
