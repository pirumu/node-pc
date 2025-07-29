import { BaseEntity } from './base.entity';

export class TransactionEntity extends BaseEntity {
  name?: string;
  type?: string;
  requestQty?: number;
  clusterId?: number;
  user?: Record<string, unknown>[];
  locations?: Record<string, unknown>[];
  locationsTemp?: Record<string, unknown>[];
  status?: string;
  isSync?: boolean; // 0 | 1
  retryCount?: number;
}
