// import { AreaEntity, BinEntity, CabinetEntity, DeviceEntity, ItemEntity, JobCardEntity, LocationItem, ReturnItemEntity } from '@entity';
//
// import { RequestIssueItemDto, WorkingOrder } from '../dtos/request';
//
// export type IssuedItem = {
//   id: string;
//   name: string;
//   itemTypeId: string;
//   type: string;
//   partNo: string;
//   materialNo: string;
//   locations: LocationItem[];
//   listWO: FormattedWO[];
// };
//
// export type FormattedWO = {
//   woId: string;
//   wo: string;
//   vehicleId: string;
//   platform: string;
//   areaId: string;
//   torq: number;
//   area: string;
// };
//
// export type FormattedData = {
//   cabinet: { id: string; name: string };
//   bin: { id: string; name: string; row: number };
//   requestItems: any[];
//   storageItems: any[];
// };
//
// export type ItemsByBin = {
//   [binId: string]: FormattedData & { requestedItemIds: Set<string> };
// };
//
// export type RequestIssueItem = RequestIssueItemDto;
// export type RequestReturnItem = RequestIssueItem;
// export type RequestWorkOrderItem = WorkingOrder;
// // ============ //
// // issue
// export type FindIssuableItemsParams = {
//   page: number;
//   limit: number;
//   keyword?: string;
//   type?: string;
//   expiryDate: number;
// };
//
// export type IssuableItemRecord = {
//   id: string;
//   name: string;
//   partNo: string;
//   materialNo: string;
//   itemTypeId: string;
//   type: string;
//   image?: string;
//   description?: string;
//   totalQuantity: number;
//   totalCalcQuantity: number;
//   binId: string;
//   binName: string;
//   dueDate?: Date;
// };
//
// export type PaginatedIssuableItemsOutput = {
//   rows: IssuableItemRecord[];
//   total: number;
// };
//
// export type ItemsForIssueInput = { expiryDate: number; userId: string; pairs: Array<{ itemId: string; binId: string }> };
//
// export type ItemsForIssueOutput = Array<{
//   item: ItemEntity;
//   bin: BinEntity;
//   cabinet: CabinetEntity;
//   devices: DeviceEntity[];
//   returnItem: ReturnItemEntity | null;
// }>;
//
// // return
// export type FindReturnableItemsParams = {
//   userId: string;
//   page: number;
//   limit: number;
//   keyword?: string;
//   type?: string;
// };
//
// export type ReturnableItemRecord = {
//   id: string;
//   name: string;
//   partNo: string;
//   materialNo: string;
//   itemTypeId: string;
//   type: string;
//   image?: string;
//   description?: string;
//   totalQuantity: number;
//   totalCalcQuantity: number;
//   issueQuantity: number;
//   locations: string[];
//   binId: string;
//   batchNo?: string;
//   serialNo?: string;
//   dueDate?: Date | null;
//   listWo?: any[];
// };
//
// export type PaginatedReturnableItemsOutput = {
//   rows: ReturnableItemRecord[];
//   total: number;
// };
//
// export type ItemsForReturnParams = { userId: string; pairs: Array<{ itemId: string; binId: string }> };
//
// export type ItemsForReturnOutput = Array<{
//   item: ItemEntity;
//   returnItem: ReturnItemEntity;
//   devices: DeviceEntity[];
// }>;
//
// // replenish
//
// export type FindReplenishableItemsParams = {
//   page: number;
//   limit: number;
//   keyword?: string;
//   type?: string;
//   replenishableTypes?: string[];
// };
//
// export type ReplenishableItemRecord = {
//   id: string;
//   name: string;
//   partNo: string;
//   materialNo: string;
//   itemTypeId: string;
//   type: string;
//   image?: string;
//   description?: string;
//   totalQuantity: number;
//   totalCalcQuantity: number;
//   locations: string[];
//   binId: string;
// };
//
// export type PaginatedReplenishableItemsOutput = {
//   rows: ReplenishableItemRecord[];
//   total: number;
// };
//
// export type ItemsForReplenishParams = { pairs: Array<{ itemId: string; binId: string }> };
//
// export type ItemsForReplenishOutput = Array<{
//   item: ItemEntity;
//   devices: (DeviceEntity & { bin: BinEntity; cabinet: CabinetEntity })[];
// }>;
//
// // working order
// export type FindJobCardsAndAreasOutput = { jobCards: JobCardEntity[]; areas: AreaEntity[] };
//
// export type BinItemCombinationOutput = {
//   id: string;
//   name: string;
// };
