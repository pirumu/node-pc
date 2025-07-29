import { BaseEntity } from './base.entity';

export interface RouterEntity extends BaseEntity {
  number: string;
  siteId?: string;
}
