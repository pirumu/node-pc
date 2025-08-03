import { PROCESS_ITEM_TYPE } from '@common/constants';
import { DeviceEntity, IssueItemEntity, ItemEntity, ReturnItemEntity } from '@entity';

export const ITEM_REPOSITORY_TOKEN = 'item';
export interface IItemRepository {
  getIssueItems(filters: { type?: string; keyword?: string; dateThreshold: Date }): Promise<IssueItemEntity[]>;

  getItemsForIssue(filters: { processBy: string; itemIds: string[]; binIds: string[]; dateThreshold: Date }): Promise<IssueItemEntity[]>;

  // getReturnItem(data: { itemId: string; userId: string; binId?: string }): Promise<ReturnItemEntity | null>;

  getItemsByType(type: PROCESS_ITEM_TYPE): Promise<any[]>;
}
