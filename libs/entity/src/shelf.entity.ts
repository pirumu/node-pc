import { BaseEntity } from './base.entity';

export class ShelfEntity extends BaseEntity {
  name: string;
  /**
   * @deprecated use info prop instead
   */
  infor?: string;
  info?: string;
  roomId?: string;
  hardWarePort?: string;
  lockerPort?: string;
  nucId?: string;
}
