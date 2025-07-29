import { BaseEntity } from './base.entity';

export class MetaDataEntity extends BaseEntity {
  lastSyncTime?: Date;
  syncVersion?: string;
}
