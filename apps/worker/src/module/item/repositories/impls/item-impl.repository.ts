// import {
//   AreaMRepository,
//   BinItemMRepository,
//   DeviceMRepository,
//   ItemMRepository,
//   ItemTypeMRepository,
//   JobCardMRepository,
//   ReturnItemMRepository,
//   TabletMRepository,
// } from '@dals/mongo/repositories';
// import { Bin } from '@dals/mongo/schema/bin.schema';
// import { Cabinet } from '@dals/mongo/schema/cabinet.schema';
// import { Device } from '@dals/mongo/schema/device.schema';
// import { Item } from '@dals/mongo/schema/item.schema';
// import { ReturnItem } from '@dals/mongo/schema/return-item.schema';
// import { BinEntity, CabinetEntity, DeviceEntity, ItemEntity, ReturnItemEntity } from '@entity';
// import { AreaMapper, BinMapper, CabinetMapper, DeviceMapper, ItemMapper, JobCardMapper, ReturnItemMapper } from '@mapper';
// import { Injectable, Logger } from '@nestjs/common';
// import { PipelineStage, Types } from 'mongoose';
//
// import { IItemRepository } from '../item.repository';
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
// } from '../item.types';
//
// @Injectable()
// export class ItemImplRepository implements IItemRepository {
//   private readonly _logger = new Logger(ItemImplRepository.name);
//
//   constructor(
//     private readonly _itemRepository: ItemMRepository,
//     private readonly _binItemRepository: BinItemMRepository,
//     private readonly _deviceRepository: DeviceMRepository,
//     private readonly _itemTypeRepository: ItemTypeMRepository,
//     private readonly _returnItemRepository: ReturnItemMRepository,
//     private readonly _jobCardRepository: JobCardMRepository,
//     private readonly _areaRepository: AreaMRepository,
//     private readonly _tabletMRepository: TabletMRepository,
//   ) {}
//
//   public async findDevicesWithItemByBinIds(binIds: string[]): Promise<Array<{ device: DeviceEntity; item: ItemEntity }>> {
//     const docs: Array<Device & { item: Item }> = (await this._deviceRepository.findMany(
//       {
//         binId: { $in: binIds.map((binId) => new Types.ObjectId(binId)) },
//       },
//       {
//         populate: { path: 'item', model: 'Item', foreignField: '_id', localField: 'itemId' },
//       },
//     )) as any;
//
//     return docs.map((doc) => ({
//       device: DeviceMapper.toEntity(doc) as DeviceEntity,
//       item: ItemMapper.toEntity(doc.item) as ItemEntity,
//     }));
//   }
//
//   //========================== ISSUE ==============================================//
//   private _buildIssuableItemMatchStage(keyword?: string, type?: string): PipelineStage[] {
//     const matchConditions: Record<string, any> = {};
//     if (type) {
//       matchConditions['item.type'] = type;
//     }
//     if (keyword) {
//       matchConditions['$or'] = [
//         { ['item.name']: { $regex: keyword, $options: 'i' } },
//         { ['item.partNo']: { $regex: keyword, $options: 'i' } },
//       ];
//     }
//
//     if (Object.keys(matchConditions).length > 0) {
//       return [{ $match: matchConditions }];
//     }
//     return [];
//   }
//
//   public async findIssuableItems(args: FindIssuableItemsParams): Promise<PaginatedIssuableItemsOutput> {
//     const { page, limit, keyword, type, expiryDate } = args;
//     const skip = (page - 1) * limit;
//
//     const pipeline: PipelineStage[] = [
//       { $match: { quantity: { $gt: 0 } } },
//       { $lookup: { from: 'bins', localField: 'binId', foreignField: '_id', as: 'bin' } },
//       { $unwind: '$bin' },
//       { $match: { ['bin.isFailed']: false, ['bin.isDamage']: false } },
//       { $lookup: { from: 'items', localField: 'itemId', foreignField: '_id', as: 'item' } },
//       { $unwind: '$item' },
//       ...this._buildIssuableItemMatchStage(keyword, type),
//       {
//         $lookup: {
//           from: 'binitems',
//           let: { binId: '$bin._id', itemId: '$item._id' },
//           pipeline: [
//             {
//               $match: {
//                 $expr: { $and: [{ $eq: ['$binId', '$$binId'] }, { $eq: ['$itemId', '$$itemId'] }] },
//                 $or: [{ expiryDate: { $gte: expiryDate } }, { expiryDate: null }],
//               },
//             },
//           ],
//           as: 'binItemInfo',
//         },
//       },
//       { $match: { ['binItemInfo.0']: { $exists: true } } },
//       { $unwind: '$binItemInfo' },
//       {
//         $facet: {
//           metadata: [{ $count: 'total' }],
//           data: [
//             { $sort: { ['item.name']: 1 } },
//             { $skip: skip },
//             { $limit: limit },
//             {
//               $project: {
//                 _id: 0,
//                 id: { $toString: '$item._id' },
//                 name: '$item.name',
//                 partNo: '$item.partNo',
//                 materialNo: '$item.materialNo',
//                 itemTypeId: { $toString: '$item.itemTypeId' },
//                 type: '$item.type',
//                 image: '$item.image',
//                 description: '$item.description',
//                 totalQuantity: '$quantity',
//                 totalCalcQuantity: '$calcQuantity',
//                 binId: { $toString: '$bin._id' },
//                 binName: '$bin.name',
//                 dueDate: '$binItemInfo.expiryDate',
//               },
//             },
//           ],
//         },
//       },
//       {
//         $project: {
//           rows: '$data',
//           total: { $ifNull: [{ $arrayElemAt: ['$metadata.total', 0] }, 0] },
//         },
//       },
//     ];
//
//     const results = await this._deviceRepository.aggregate<PaginatedIssuableItemsOutput>(pipeline);
//     return results[0] || { rows: [], total: 0 };
//   }
//
//   public async findItemsForIssue(args: ItemsForIssueInput): Promise<ItemsForIssueOutput> {
//     const { userId, pairs, expiryDate } = args;
//     if (!pairs || pairs.length === 0) {
//       return [];
//     }
//     const matchConditions = pairs.map((pair) => ({
//       binId: new Types.ObjectId(pair.binId),
//       itemId: new Types.ObjectId(pair.itemId),
//       $or: [{ expiryDate: { $gte: expiryDate } }, { expiryDate: { $eq: null } }],
//     }));
//     const pipeline: PipelineStage[] = [
//       {
//         $match: {
//           $or: matchConditions,
//         },
//       },
//       {
//         $lookup: {
//           from: 'items',
//           localField: 'itemId',
//           foreignField: '_id',
//           as: 'itemDocs',
//         },
//       },
//       { $match: { ['itemDocs.0']: { $exists: true } } },
//       { $addFields: { item: { $first: '$itemDocs' } } },
//       {
//         $lookup: {
//           from: 'bins',
//           localField: 'binId',
//           foreignField: '_id',
//           as: 'binDocs',
//         },
//       },
//       { $match: { ['binDocs.0']: { $exists: true } } },
//       { $addFields: { bin: { $first: '$binDocs' } } },
//       { $match: { ['bin.isFailed']: false, ['bin.isDamage']: false } },
//       {
//         $lookup: {
//           from: 'cabinets',
//           localField: 'bin.cabinetId',
//           foreignField: '_id',
//           as: 'cabinetDocs',
//         },
//       },
//       { $match: { ['cabinetDocs.0']: { $exists: true } } },
//       { $addFields: { cabinet: { $first: '$cabinetDocs' } } },
//       {
//         $lookup: {
//           from: 'devices',
//           let: { itemId: '$itemId', binId: '$binId' },
//           pipeline: [
//             {
//               $match: {
//                 quantity: { $gt: 0 },
//                 $expr: {
//                   $and: [{ $eq: ['$itemId', '$$itemId'] }, { $eq: ['$binId', '$$binId'] }],
//                 },
//               },
//             },
//           ],
//           as: 'devices',
//         },
//       },
//       { $match: { ['devices.0']: { $exists: true } } },
//       {
//         $lookup: {
//           from: 'returnitems',
//           let: { itemId: '$itemId' },
//           pipeline: [
//             {
//               $match: {
//                 userId: new Types.ObjectId(userId),
//                 $expr: { $eq: ['$itemId', '$$itemId'] },
//               },
//             },
//             { $sort: { createdAt: -1 } },
//             { $limit: 1 },
//           ],
//           as: 'returnItemDocs',
//         },
//       },
//       {
//         $addFields: {
//           returnItem: { $first: '$returnItemDocs' },
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           item: 1,
//           bin: 1,
//           cabinet: 1,
//           devices: 1,
//           returnItem: 1,
//         },
//       },
//     ];
//     const resultsAsDocs = await this._binItemRepository.aggregate<{
//       item: Item;
//       bin: Bin;
//       cabinet: Cabinet;
//       devices: Device[];
//       returnItem: ReturnItem | null;
//     }>(pipeline);
//
//     return resultsAsDocs.map((doc) => ({
//       item: ItemMapper.toEntity(doc.item) as ItemEntity,
//       bin: BinMapper.toEntity(doc.bin) as BinEntity,
//       cabinet: CabinetMapper.toEntity(doc.cabinet) as CabinetEntity,
//       devices: DeviceMapper.toEntities(doc.devices) as DeviceEntity[],
//       returnItem: ReturnItemMapper.toEntity(doc.returnItem),
//     }));
//   }
//
//   //========================== Return ==============================================//
//   private _buildReturnableItemMatchStage(keyword?: string, type?: string, prefix = ''): PipelineStage[] {
//     const matchConditions: Record<string, any> = {};
//     if (type) {
//       matchConditions[`${prefix}type`] = type;
//     }
//     if (keyword) {
//       matchConditions['$or'] = [
//         { [`${prefix}name`]: { $regex: keyword, $options: 'i' } },
//         { [`${prefix}partNo`]: { $regex: keyword, $options: 'i' } },
//       ];
//     }
//     if (Object.keys(matchConditions).length > 0) {
//       return [{ $match: matchConditions }];
//     }
//     return [];
//   }
//
//   public async findReturnableItems(args: FindReturnableItemsParams): Promise<PaginatedReturnableItemsOutput> {
//     const { userId, page, limit, keyword, type } = args;
//     const skip = (page - 1) * limit;
//
//     const pipeline: PipelineStage[] = [
//       {
//         $match: { userId: new Types.ObjectId(userId) },
//       },
//       {
//         $lookup: { from: 'items', localField: 'itemId', foreignField: '_id', as: 'item' },
//       },
//       { $unwind: '$item' },
//       ...this._buildReturnableItemMatchStage(keyword, type, 'item.'),
//       { $unwind: '$locations' },
//
//       { $match: { ['locations.quantity']: { $gt: 0 } } },
//       {
//         $lookup: { from: 'bins', localField: 'locations.bin.id', foreignField: '_id', as: 'binInfo' },
//       },
//       { $unwind: '$binInfo' },
//       { $match: { ['binInfo.isFailed']: false, ['binInfo.isDamage']: false } },
//       {
//         $lookup: {
//           from: 'devices',
//           let: { binId: '$binInfo._id', itemId: '$item._id' },
//           pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$binId', '$$binId'] }, { $eq: ['$itemId', '$$itemId'] }] } } }],
//           as: 'deviceInfo',
//         },
//       },
//       { $unwind: { path: '$deviceInfo', preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: 'binitems',
//           let: { binId: '$binInfo._id', itemId: '$item._id' },
//           pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$binId', '$$binId'] }, { $eq: ['$itemId', '$$itemId'] }] } } }],
//           as: 'binItemInfo',
//         },
//       },
//       { $unwind: { path: '$binItemInfo', preserveNullAndEmptyArrays: true } },
//       {
//         $facet: {
//           metadata: [{ $count: 'total' }],
//           data: [
//             { $sort: { ['item.name']: 1 } },
//             { $skip: skip },
//             { $limit: limit },
//             {
//               $project: {
//                 _id: 0,
//                 id: { $toString: '$item._id' },
//                 name: '$item.name',
//                 partNo: '$item.partNo',
//                 materialNo: '$item.materialNo',
//                 itemTypeId: { $toString: '$item.itemTypeId' },
//                 type: '$item.type',
//                 image: '$item.image',
//                 description: '$item.description',
//                 totalQuantity: { $ifNull: ['$deviceInfo.quantity', 0] },
//                 totalCalcQuantity: { $ifNull: ['$deviceInfo.calcQuantity', 0] },
//                 issueQuantity: '$locations.quantity',
//                 locations: ['$binInfo.name'],
//                 binId: { $toString: '$binInfo._id' },
//                 batchNo: '$binItemInfo.batchNo',
//                 serialNo: '$binItemInfo.serialNo',
//                 dueDate: '$binItemInfo.expiryDate',
//                 workingOrders: '$workingOrders',
//               },
//             },
//           ],
//         },
//       },
//       {
//         $project: {
//           rows: '$data',
//           total: { $ifNull: [{ $arrayElemAt: ['$metadata.total', 0] }, 0] },
//         },
//       },
//     ];
//
//     const results = await this._returnItemRepository.aggregate<PaginatedReturnableItemsOutput>(pipeline);
//
//     return results[0] || { rows: [], total: 0 };
//   }
//
//   public async findItemsForReturn(args: ItemsForReturnParams): Promise<ItemsForReturnOutput> {
//     const { userId, pairs } = args;
//     if (!pairs || pairs.length === 0) {
//       return [];
//     }
//     const matchConditions = pairs.map((pair) => ({
//       userId: new Types.ObjectId(userId),
//       itemId: new Types.ObjectId(pair.itemId),
//       binId: new Types.ObjectId(pair.binId),
//     }));
//
//     const pipeline: PipelineStage[] = [
//       {
//         $match: {
//           $or: matchConditions,
//         },
//       },
//       {
//         $lookup: {
//           from: 'items',
//           localField: 'itemId',
//           foreignField: '_id',
//           as: 'itemDocs',
//         },
//       },
//       { $match: { ['itemDocs.0']: { $exists: true } } },
//       { $addFields: { item: { $first: '$itemDocs' } } },
//       {
//         $lookup: {
//           from: 'devices',
//           localField: 'itemId',
//           foreignField: 'itemId',
//           as: 'devices',
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           returnItem: '$$ROOT',
//           item: '$item',
//           devices: '$devices',
//         },
//       },
//       {
//         $unset: ['returnItem.itemDocs', 'returnItem.item', 'returnItem.devices'],
//       },
//     ];
//
//     const docs = await this._returnItemRepository.aggregate<{
//       returnItem: ReturnItem;
//       item: Item;
//       devices: Device[];
//     }>(pipeline);
//
//     return docs.map((doc) => ({
//       returnItem: ReturnItemMapper.toEntity(doc.returnItem) as ReturnItemEntity,
//       item: ItemMapper.toEntity(doc.item) as ItemEntity,
//       devices: DeviceMapper.toEntities(doc.devices),
//     }));
//   }
//
//   //========================== Replenish ==============================================//
//   private _buildReplenishableItemMatchStage(keyword?: string): PipelineStage[] {
//     const matchConditions: Record<string, any> = {};
//     if (keyword) {
//       matchConditions['$or'] = [
//         { ['item.name']: { $regex: keyword, $options: 'i' } },
//         { ['item.partNo']: { $regex: keyword, $options: 'i' } },
//       ];
//     }
//
//     if (Object.keys(matchConditions).length > 0) {
//       return [{ $match: matchConditions }];
//     }
//     return [];
//   }
//
//   public async findReplenishableItems(args: FindReplenishableItemsParams): Promise<PaginatedReplenishableItemsOutput> {
//     const { page, limit, keyword, type } = args;
//     const skip = (page - 1) * limit;
//
//     const pipeline: PipelineStage[] = [
//       {
//         $match: {
//           $expr: { $lt: ['$quantity', '$calcQuantity'] },
//         },
//       },
//       {
//         $lookup: { from: 'bins', localField: 'binId', foreignField: '_id', as: 'bin' },
//       },
//       { $unwind: '$bin' },
//       { $match: { ['bin.isFailed']: false, ['bin.isDamage']: false } },
//       {
//         $lookup: { from: 'items', localField: 'itemId', foreignField: '_id', as: 'item' },
//       },
//       { $unwind: '$item' },
//       ...this._buildReplenishableItemMatchStage(keyword),
//       {
//         $lookup: {
//           from: 'item_types',
//           localField: 'item.itemTypeId',
//           foreignField: '_id',
//           as: 'itemTypeInfo',
//         },
//       },
//       { $unwind: '$itemTypeInfo' },
//       {
//         $match: type ? { ['itemTypeInfo.type']: type } : { ['itemTypeInfo.isReturn']: false },
//       },
//       {
//         $facet: {
//           metadata: [{ $count: 'total' }],
//           data: [
//             { $sort: { ['item.name']: 1 } },
//             { $skip: skip },
//             { $limit: limit },
//             {
//               $project: {
//                 _id: 0,
//                 id: { $toString: '$item._id' },
//                 name: '$item.name',
//                 partNo: '$item.partNo',
//                 materialNo: '$item.materialNo',
//                 itemTypeId: { $toString: '$item.itemTypeId' },
//                 type: '$item.type',
//                 image: '$item.image',
//                 description: '$item.description',
//                 totalQuantity: '$quantity',
//                 totalCalcQuantity: '$calcQuantity',
//                 locations: ['$bin.name'],
//                 binId: { $toString: '$bin._id' },
//               },
//             },
//           ],
//         },
//       },
//       {
//         $project: {
//           rows: '$data',
//           total: { $ifNull: [{ $arrayElemAt: ['$metadata.total', 0] }, 0] },
//         },
//       },
//     ];
//
//     const result = await this._deviceRepository.aggregate<PaginatedReplenishableItemsOutput>(pipeline);
//     return result[0] || { rows: [], total: 0 };
//   }
//
//   public async findItemsForReplenish(args: ItemsForReplenishParams): Promise<ItemsForReplenishOutput> {
//     const { pairs } = args;
//     if (!pairs || pairs.length === 0) {
//       return [];
//     }
//
//     const itemIds = pairs.map((p) => new Types.ObjectId(p.itemId));
//     const binIds = pairs.map((p) => new Types.ObjectId(p.binId));
//
//     const pipeline: PipelineStage[] = [
//       {
//         $match: {
//           _id: { $in: itemIds },
//         },
//       },
//       {
//         $lookup: {
//           from: 'devices',
//           let: { itemId: '$_id' },
//           pipeline: [
//             {
//               $match: {
//                 binId: { $in: binIds },
//                 $expr: {
//                   $and: {
//                     $eq: ['$itemId', '$$itemId'],
//                     $lt: ['$quantity', '$calcQuantity'],
//                   },
//                 },
//               },
//             },
//             {
//               $lookup: { from: 'bins', localField: 'binId', foreignField: '_id', as: 'bin' },
//             },
//             { $unwind: '$bin' },
//             {
//               $lookup: { from: 'cabinets', localField: 'bin.cabinetId', foreignField: '_id', as: 'bin.cabinet' },
//             },
//             { $unwind: '$bin.cabinet' },
//           ],
//           as: 'devices',
//         },
//       },
//       {
//         $match: {
//           ['devices.0']: { $exists: true },
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           item: '$$ROOT',
//           devices: '$devices',
//         },
//       },
//       {
//         $unset: 'item.devices',
//       },
//     ];
//
//     const docs = await this._itemRepository.aggregate<{ item: Item; devices: (Device & { bin: Bin; cabinet: Cabinet })[] }>(pipeline);
//
//     return docs.map(
//       (doc) =>
//         ({
//           item: ItemMapper.toEntity(doc.item) as ItemEntity,
//           devices: doc.devices.map((d) => ({
//             ...DeviceMapper.toEntity(d),
//             bin: BinMapper.toEntity(d.bin) as BinEntity,
//             cabinet: CabinetMapper.toEntity(d.cabinet) as CabinetEntity,
//           })),
//         }) as any,
//     );
//   }
//
//   public async findJobCardsAndAreas(woIds: string[], areaIds: string[]): Promise<FindJobCardsAndAreasOutput> {
//     const woObjectIds = woIds.map((id) => new Types.ObjectId(id));
//     const areaObjectIds = areaIds.map((id) => new Types.ObjectId(id));
//
//     const [jobCardDocs, areaDocs] = await Promise.all([
//       this._jobCardRepository.findMany({ _id: { $in: woObjectIds } }),
//       this._areaRepository.findMany({ _id: { $in: areaObjectIds } }),
//     ]);
//
//     return { jobCards: JobCardMapper.toEntities(jobCardDocs), areas: AreaMapper.toEntities(areaDocs) };
//   }
//
//   public async findDevicesWithItemByBinId(binIds: string[]): Promise<Array<DeviceEntity & { item: ItemEntity }>> {
//     const binObjectIds = binIds.map((id) => new Types.ObjectId(id));
//     const docs = await this._deviceRepository.findMany(
//       {
//         binId: { $in: binObjectIds },
//       },
//       {
//         populate: {
//           path: 'itemId',
//           model: 'Item',
//         },
//       },
//     );
//     return docs.map((doc) => {
//       const { item, ...deviceDoc } = doc as any;
//       return {
//         ...DeviceMapper.toEntity(deviceDoc),
//         item: ItemMapper.toEntity(item),
//       } as DeviceEntity & { item: ItemEntity };
//     });
//   }
//
//   public async updateReturnItemWorkingOrder(userId: string, itemId: string, workOrders: any[]): Promise<ReturnItem> {
//     return this._returnItemRepository.updateFirst(
//       {
//         user_id: new Types.ObjectId(userId),
//         item_id: new Types.ObjectId(itemId),
//       },
//       { $set: { workOrders: workOrders } },
//       { returnDocument: 'after' },
//     );
//   }
//
//   public async findClusterIdForProcess(tabletDeviceId: string): Promise<string | null> {
//     const doc = await this._tabletMRepository.findFirst({
//       deviceId: tabletDeviceId,
//     });
//
//     if (!doc || !doc.setting?.clusterId) {
//       return null;
//     }
//     return doc.setting.clusterId;
//   }
//
//   public async findBinItemCombinations(keyword?: string): Promise<BinItemCombinationOutput[]> {
//     const pipeline: PipelineStage[] = [
//       {
//         $lookup: {
//           from: 'bins',
//           localField: 'binId',
//           foreignField: '_id',
//           as: 'bin',
//         },
//       },
//       { $unwind: '$bin' },
//       {
//         $lookup: {
//           from: 'items',
//           localField: 'itemId',
//           foreignField: '_id',
//           as: 'item',
//         },
//       },
//       { $unwind: '$item' },
//       {
//         $lookup: {
//           from: 'cabinets',
//           localField: 'bin.cabinetId',
//           foreignField: '_id',
//           as: 'cabinet',
//         },
//       },
//       { $unwind: '$cabinet' },
//       {
//         $project: {
//           _id: 0,
//           id: { $concat: [{ $toString: '$bin._id' }, '_', { $toString: '$item._id' }] },
//           name: {
//             $concat: ['$cabinet.name', '_', '$bin.row', '_', '$bin.name', '_', '$item.name', '_', '$item.partNo'],
//           },
//         },
//       },
//       ...(keyword ? [{ $match: { name: { $regex: keyword, $options: 'i' } } }] : []),
//       { $sort: { name: 1 } },
//     ];
//
//     return this._binItemRepository.aggregate<BinItemCombinationOutput>(pipeline);
//   }
//
//   //============================= Types ============================================//
//   public async findIssuableItemTypes(): Promise<string[]> {
//     const pipeline: PipelineStage[] = [
//       { $match: { isIssue: true } },
//       {
//         $lookup: {
//           from: 'items',
//           localField: '_id',
//           foreignField: 'itemTypeId',
//           as: 'items',
//         },
//       },
//       { $unwind: '$items' },
//       {
//         $lookup: {
//           from: 'binitems',
//           localField: 'items._id',
//           foreignField: 'itemId',
//           as: 'binItemLink',
//         },
//       },
//       { $match: { ['binItemLink.0']: { $exists: true } } },
//       { $group: { _id: '$type' } },
//       { $project: { _id: 0, type: '$_id' } },
//     ];
//     const results = await this._itemTypeRepository.aggregate<{ type: string }>(pipeline);
//     return results.map((r) => r.type);
//   }
//   public async findReturnableItemTypes(): Promise<string[]> {
//     const pipeline: PipelineStage[] = [
//       { $match: { isReturn: true } },
//       {
//         $lookup: {
//           from: 'items',
//           localField: '_id',
//           foreignField: 'itemTypeId',
//           as: 'items',
//         },
//       },
//       { $unwind: '$items' },
//       {
//         $lookup: {
//           from: 'return_items',
//           localField: 'items._id',
//           foreignField: 'itemId',
//           as: 'returnItemLink',
//         },
//       },
//       { $match: { ['returnItemLink.0']: { $exists: true } } },
//       { $group: { _id: '$type' } },
//       { $project: { _id: 0, type: '$_id' } },
//     ];
//     const results = await this._itemRepository.aggregate<{ type: string }>(pipeline);
//     return results.map((r) => r.type);
//   }
//   public async findReplenishableItemTypes(): Promise<string[]> {
//     const pipeline: PipelineStage[] = [
//       { $match: { isReplenish: true } },
//       {
//         $lookup: {
//           from: 'items',
//           localField: '_id',
//           foreignField: 'itemTypeId',
//           as: 'items',
//         },
//       },
//       { $unwind: '$items' },
//       {
//         $lookup: {
//           from: 'devices',
//           localField: 'items._id',
//           foreignField: 'itemId',
//           as: 'deviceInfo',
//         },
//       },
//       { $unwind: '$deviceInfo' },
//       { $match: { $expr: { $lt: ['$deviceInfo.quantity', '$deviceInfo.calcQuantity'] } } },
//       { $group: { _id: '$type' } },
//       { $project: { _id: 0, type: '$_id' } },
//     ];
//     const results = await this._itemTypeRepository.aggregate<{ type: string }>(pipeline);
//     return results.map((r) => r.type);
//   }
// }
