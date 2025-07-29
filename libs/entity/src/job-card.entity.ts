import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export class JobCardEntity extends BaseEntity {
  wo: string;
  platform: string;
  vehicleId: string;
  status: number;
  cardNumber: string;
  vehicleNum: number;
  vehicleType: string;
  isSync: boolean;
  retryCount: number;

  constructor(props: Properties<JobCardEntity>) {
    super();
    Object.assign(this, props);
  }
}
