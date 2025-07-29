import { BaseEntity } from './base.entity';

export class JobEntity extends BaseEntity {
  title?: string;
  payload?: string;
  syncStatus?: number;
}
