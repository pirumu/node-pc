import { PartialProperties } from '@framework/types';
import { Embedded } from '@mikro-orm/core';
import { Embeddable, Property } from '@mikro-orm/mongodb';

@Embeddable()
export class SyncInfo {
  @Property()
  isSynced: boolean = false;

  @Property({ nullable: true })
  startSyncAt?: Date;

  @Property({ nullable: true })
  syncCompletedAt?: Date;

  @Property()
  retryCount: number = 0;

  @Property()
  maxRetries: number = 5;

  @Property({ type: 'json', nullable: true })
  errorDetails?: any;

  constructor(data?: PartialProperties<SyncInfo>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}

@Embeddable()
export class Synchronization {
  @Embedded(() => SyncInfo)
  cloudToLocal = new SyncInfo();

  @Embedded(() => SyncInfo)
  localToCloud = new SyncInfo();

  constructor() {
    this.cloudToLocal = new SyncInfo();
    this.localToCloud = new SyncInfo();
  }
}
