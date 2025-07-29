import { BaseEntity } from './base.entity';
import { Properties } from '@framework/types';

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
