import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export type TabletSettings = {
  clusterId: string;
  username: string;
  password: string;
  intervalSyncTime: number;
  cloudUrl: string;
  compensationTime: number;
  torqueWrenchTypeId: number;
  is2fa: boolean;
  accessKey?: string;
};

export class TabletEntity extends BaseEntity {
  deviceId: string;
  deviceKey: string;
  setting: TabletSettings;

  constructor(props: Properties<TabletEntity>) {
    super();
    Object.assign(this, props);
  }
}
