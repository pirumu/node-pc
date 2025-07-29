import { BaseEntity } from './base.entity';

export interface RoomEntity extends BaseEntity {
  name: string;
  description?: string;
  siteId?: string;
}
