import { BaseEntity } from './base.entity';

export class WithDrawEntity extends BaseEntity {
  sessionId?: number;
  deviceId: number;
  deviceName: string;
  changeQuantity: number;
  shelfId?: string;
  roomId?: string;
  siteId?: string;
  shelfName: string;
  roomName: string;
  siteName: string;
}
