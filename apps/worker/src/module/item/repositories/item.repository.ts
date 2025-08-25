// import { DeviceEntity, ItemEntity } from '@entity';
//
// import {
//   BinItemCombinationOutput,
//   FindIssuableItemsParams,
//   FindJobCardsAndAreasOutput,
//   FindReplenishableItemsParams,
//   FindReturnableItemsParams,
//   ItemsForIssueInput,
//   ItemsForIssueOutput,
//   ItemsForReplenishParams,
//   ItemsForReplenishOutput,
//   ItemsForReturnParams,
//   ItemsForReturnOutput,
//   PaginatedIssuableItemsOutput,
//   PaginatedReplenishableItemsOutput,
//   PaginatedReturnableItemsOutput,
// } from './item.types';
//
// export const ITEM_REPOSITORY_TOKEN = 'IItemRepository';
//
// export interface IItemRepository {
//   findClusterIdForProcess(tabletDeviceId: string): Promise<string | null>;
//   findIssuableItems(args: FindIssuableItemsParams): Promise<PaginatedIssuableItemsOutput>;
//   findItemsForIssue(args: ItemsForIssueInput): Promise<ItemsForIssueOutput>;
//   findReturnableItems(args: FindReturnableItemsParams): Promise<PaginatedReturnableItemsOutput>;
//   findItemsForReturn(args: ItemsForReturnParams): Promise<ItemsForReturnOutput>;
//   findReplenishableItems(args: FindReplenishableItemsParams): Promise<PaginatedReplenishableItemsOutput>;
//   findItemsForReplenish(args: ItemsForReplenishParams): Promise<ItemsForReplenishOutput>;
//   findJobCardsAndAreas(woIds: string[], areaIds: string[]): Promise<FindJobCardsAndAreasOutput>;
//   findDevicesWithItemByBinIds(binIds: string[]): Promise<Array<{ device: DeviceEntity; item: ItemEntity }>>;
//   updateReturnItemWorkingOrder(userId: string, itemId: string, workOrders: any[]): Promise<any>;
//   findBinItemCombinations(keyword?: string): Promise<BinItemCombinationOutput[]>;
//   findIssuableItemTypes(): Promise<string[]>;
//   findReturnableItemTypes(): Promise<string[]>;
//   findReplenishableItemTypes(): Promise<string[]>;
// }
