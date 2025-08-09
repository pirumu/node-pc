import { DeviceEntity, ItemEntity } from '@entity';

import {
  BinItemCombinationOutput,
  FindIssuableItemsArgs,
  FindJobCardsAndAreasOutput,
  FindReplenishableItemsArgs,
  FindReturnableItemsArgs,
  ItemsForIssueInput,
  ItemsForIssueOutput,
  ItemsForReplenishArgs,
  ItemsForReplenishOutput,
  ItemsForReturnArgs,
  ItemsForReturnOutput,
  PaginatedIssuableItemsOutput,
  PaginatedReplenishableItemsOutput,
  PaginatedReturnableItemsOutput,
} from './item.types';

export const ITEM_REPOSITORY_TOKEN = 'IItemRepository';

export interface IItemRepository {
  findClusterIdForProcess(tabletDeviceId: string): Promise<string | null>;
  findIssuableItems(args: FindIssuableItemsArgs): Promise<PaginatedIssuableItemsOutput>;
  findItemsForIssue(args: ItemsForIssueInput): Promise<ItemsForIssueOutput>;
  findReturnableItems(args: FindReturnableItemsArgs): Promise<PaginatedReturnableItemsOutput>;
  findItemsForReturn(args: ItemsForReturnArgs): Promise<ItemsForReturnOutput>;
  findReplenishableItems(args: FindReplenishableItemsArgs): Promise<PaginatedReplenishableItemsOutput>;
  findItemsForReplenish(args: ItemsForReplenishArgs): Promise<ItemsForReplenishOutput>;
  findJobCardsAndAreas(woIds: string[], areaIds: string[]): Promise<FindJobCardsAndAreasOutput>;
  findDevicesWithItemByBinIds(binIds: string[]): Promise<Array<{ device: DeviceEntity; item: ItemEntity }>>;
  updateReturnItemWorkingOrder(userId: string, itemId: string, workOrders: any[]): Promise<any>;
  findBinItemCombinations(keyword?: string): Promise<BinItemCombinationOutput[]>;
  findIssuableItemTypes(): Promise<string[]>;
  findReturnableItemTypes(): Promise<string[]>;
  findReplenishableItemTypes(): Promise<string[]>;
}
