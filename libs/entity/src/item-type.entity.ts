import { BaseEntity } from './base.entity';

export class ItemTypeEntity extends BaseEntity {
  type: string;
  description: string;
  isIssue: boolean;
  isReturn: boolean;
  isReplenish: boolean;
}
