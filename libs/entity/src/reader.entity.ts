import { BaseEntity } from './base.entity';

export class ReaderEntity extends BaseEntity {
  code: string;
  currentUser?: string;
  maximumTime?: number;
  isConfirm: boolean;
  shelfId?: string;
}
