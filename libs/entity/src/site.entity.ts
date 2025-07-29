import { BaseEntity } from './base.entity';

export class SiteEntity extends BaseEntity {
  name: string;
  email?: string;
  mobile?: string;
  reportSchedule?: string;
  reportTiming?: string;
  reportFormat?: string;
  lowStockSchedule?: string;
  lowStockTiming?: string;
  typeNotification?: string;
}
