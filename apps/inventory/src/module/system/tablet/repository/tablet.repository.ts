import { TabletEntity } from '@entity';

export const TABLET_REPOSITORY_TOKEN = Symbol('ITabletRepository');

export interface ITabletRepository {
  findOne(): Promise<TabletEntity | null>;
  create(entity: TabletEntity): Promise<TabletEntity>;
  update(id: string, data: Partial<TabletEntity>): Promise<boolean>;
  exist(deviceKey: string): Promise<boolean>;
}
