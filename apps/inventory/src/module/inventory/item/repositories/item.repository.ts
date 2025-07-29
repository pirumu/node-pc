import { DeviceEntity, IssueItemEntity, ItemEntity, ReturnItemEntity } from '@entity';

export const ITEM_REPOSITORY_TOKEN = 'item';
export interface IItemRepository {
  getIssueItems(filters: { type?: string; keyword?: string; dateThreshold: Date }): Promise<IssueItemEntity[]>;
  getItemsForIssue(...args: any[]): Promise<
    Array<{
      id: string;
      name: string;
      partNo: number;
      materialNo: number;
      itemTypeId: string;
      type: string;
      requestedBinId: string;
      devices: DeviceEntity[];
    }>
  >;

  getItemById(id: string): Promise<ItemEntity | null>;

  getReturnItem(data: { itemId: string; userId: string; binId?: string }): Promise<ReturnItemEntity | null>;
}
