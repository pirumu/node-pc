import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export type TabletSettings = {};

export class TabletEntity extends BaseEntity {
  deviceId: string;
  deviceKey: string;
  setting: TabletSettings;

  constructor(props: Properties<TabletEntity>) {
    super();
    Object.assign(this, props);
  }
}
