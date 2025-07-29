import { Properties } from '@framework/types';

import { BaseEntity } from './base.entity';

export class BinEntity extends BaseEntity {
  cabinetId: string;
  name: string;
  cuId: number;
  lockId: number;
  row: number;
  min: number;
  max: number;
  critical: number;
  description?: string;
  processBy?: string;
  processTime?: string;
  countFailed: number;
  isProcessing: boolean;
  isFailed: boolean;
  isLocked: boolean;
  isRfid: boolean;
  isDamage?: boolean;
  isDrawer: boolean;
  drawerName: string;
  status: string;
  isSync: boolean;
  retryCount: number;
  isCalibrated: boolean;
  newMax?: number;

  constructor(props: Properties<BinEntity>) {
    super();
    Object.assign(this, props);
  }

  public incrementFailedAttempt(): void {
    this.countFailed++;
  }

  public hasExceededFailedAttempts(maxOpenAttempts: number): boolean {
    return this.countFailed >= maxOpenAttempts;
  }

  public markFailed(): void {
    this.isFailed = true;
  }

  public markAlive(): void {
    this.countFailed = 0;
    this.isFailed = false;
  }

  public activate(): void {
    this.countFailed = 0;
    this.isFailed = false;
    this.isSync = false;
    this.retryCount = 0;
  }

  public deactivate(): void {
    this.isFailed = true;
    this.isSync = false;
    this.retryCount = 0;
  }
}
