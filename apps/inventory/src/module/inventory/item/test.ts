// import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model, Types } from 'mongoose';
//
// import { PROCESS_ITEM_TYPE } from '../constants';
// import { ProcessItemService } from '../process-item/process-item.service';
// import { Area } from '../schemas/area.schema';
// import { BinItem } from '../schemas/bin-item.schema';
// import { Bin } from '../schemas/bin.schema';
// import { Cabinet } from '../schemas/cabinet.schema';
// import { Device } from '../schemas/device.schema';
// import { Item } from '../schemas/item.schema';
// import { JobCard } from '../schemas/job-card.schema';
// import { ReturnItem } from '../schemas/return-item.schema';
//
// interface IssueItemDto {
//   itemId: string;
//   quantity: number;
//   listWO: Array<{
//     woId: string;
//     areaId: string;
//   }>;
//   binId: string;
// }
//
// interface IssueRequestDto {
//   items: IssueItemDto[];
// }
//
// interface Location {
//   cabinet: {
//     id: string;
//     name: string;
//   };
//   bin: {
//     id: string;
//     name: string;
//     row: string;
//   };
//   preQty?: number;
//   requestQty?: number;
//   quantity?: number;
// }
//
// @Injectable()
// export class ItemService {
//   constructor(
//     @InjectModel(Item.name) private itemModel: Model<Item>,
//     @InjectModel(Device.name) private deviceModel: Model<Device>,
//     @InjectModel(ReturnItem.name) private returnItemModel: Model<ReturnItem>,
//     @InjectModel(Bin.name) private binModel: Model<Bin>,
//     @InjectModel(Cabinet.name) private cabinetModel: Model<Cabinet>,
//     @InjectModel(BinItem.name) private binItemModel: Model<BinItem>,
//     @InjectModel(JobCard.name) private jobCardModel: Model<JobCard>,
//     @InjectModel(Area.name) private areaModel: Model<Area>,
//     private processItemService: ProcessItemService,
//   ) {}
//
//   async issue(issueRequestDto: IssueRequestDto, currentUser: any, uniqueId: string, token: string) {
//     try {
//       const { items } = issueRequestDto;
//
//       const dateThreshold = new Date();
//       dateThreshold.setHours(0, 0, 0, 0);
//
//       // Extract all unique IDs for batch queries
//       const itemIds = [...new Set(items.map((item) => item.itemId))];
//       const binIds = [...new Set(items.map((item) => item.binId))];
//       const allWoIds = items.filter((item) => item.listWO && item.listWO.length > 0).flatMap((item) => item.listWO.map((wo) => wo.woId));
//       const allAreaIds = items
//         .filter((item) => item.listWO && item.listWO.length > 0)
//         .flatMap((item) => item.listWO.map((wo) => wo.areaId));
//
//       // Batch fetch all required data
//       const [itemsData, binsData, devicesData, binItemsData, returnItemsData, jobCardsData, areasData] = await Promise.all([
//         // Fetch all items
//         this.itemModel.find({ _id: { $in: itemIds } }),
//
//         // Fetch all bins with cabinet info
//         this.binModel.aggregate([
//           { $match: { _id: { $in: binIds.map((id) => new Types.ObjectId(id)) } } },
//           {
//             $lookup: {
//               from: 'cabinets',
//               localField: 'cabinetId',
//               foreignField: '_id',
//               as: 'cabinet',
//             },
//           },
//           { $unwind: '$cabinet' },
//         ]),
//
//         // Fetch all devices for items and bins
//         this.deviceModel
//           .find({
//             itemId: { $in: itemIds.map((id) => new Types.ObjectId(id)) },
//             binId: { $in: binIds.map((id) => new Types.ObjectId(id)) },
//             quantity: { $gt: 0 },
//           })
//           .sort({ binId: 1 }),
//
//         // Fetch all bin items
//         this.binItemModel.find({
//           itemId: { $in: itemIds.map((id) => new Types.ObjectId(id)) },
//           binId: { $in: binIds.map((id) => new Types.ObjectId(id)) },
//           $or: [{ expiryDate: { $gte: dateThreshold } }, { expiryDate: null }],
//         }),
//
//         // Fetch return items for current user
//         this.returnItemModel.find({
//           userId: currentUser.id,
//           itemId: { $in: itemIds.map((id) => new Types.ObjectId(id)) },
//         }),
//
//         // Fetch job cards if needed
//         allWoIds.length > 0 ? this.jobCardModel.find({ _id: { $in: allWoIds } }) : Promise.resolve([]),
//
//         // Fetch areas if needed
//         allAreaIds.length > 0 ? this.areaModel.find({ _id: { $in: allAreaIds } }) : Promise.resolve([]),
//       ]);
//
//       // Create lookup maps for O(1) access
//       const itemsMap = new Map(itemsData.map((item) => [item._id.toString(), item]));
//       const binsMap = new Map(binsData.map((bin) => [bin._id.toString(), bin]));
//       const devicesMap = new Map<string, Device[]>();
//       const binItemsMap = new Map<string, BinItem>();
//       const returnItemsMap = new Map(returnItemsData.map((ri) => [ri.itemId.toString(), ri]));
//       const jobCardsMap = new Map(jobCardsData.map((jc) => [jc._id.toString(), jc]));
//       const areasMap = new Map(areasData.map((area) => [area._id.toString(), area]));
//
//       // Group devices by itemId-binId key
//       devicesData.forEach((device) => {
//         const key = `${device.itemId}-${device.binId}`;
//         if (!devicesMap.has(key)) {
//           devicesMap.set(key, []);
//         }
//         devicesMap.get(key).push(device);
//       });
//
//       // Create binItems lookup
//       binItemsData.forEach((binItem) => {
//         const key = `${binItem.itemId}-${binItem.binId}`;
//         binItemsMap.set(key, binItem);
//       });
//
//       // Process each item in request
//       const result = [];
//       let requestQty = 0;
//
//       for (const item of items) {
//         const { itemId, quantity, listWO, binId } = item;
//         requestQty += quantity;
//
//         // Get data from maps
//         const itemData = itemsMap.get(itemId);
//         const binData = binsMap.get(binId);
//         const deviceKey = `${itemId}-${binId}`;
//         const devices = devicesMap.get(deviceKey) || [];
//         const binItem = binItemsMap.get(deviceKey);
//         const returnItem = returnItemsMap.get(itemId);
//
//         // Validations
//         if (!itemData) {
//           throw new HttpException(`Item ${itemId} not found`, HttpStatus.NOT_FOUND);
//         }
//
//         if (!binData) {
//           throw new HttpException(`Bin ${binId} not found`, HttpStatus.NOT_FOUND);
//         }
//
//         if (binData.isFailed || binData.isDamage) {
//           throw new HttpException(`Bin ${binId} is failed or damaged`, HttpStatus.BAD_REQUEST);
//         }
//
//         if (devices.length === 0) {
//           throw new HttpException(`Item ${itemId} not found on device in bin ${binId}`, HttpStatus.NOT_FOUND);
//         }
//
//         if (!binItem) {
//           throw new HttpException(`Item ${itemId} not found in bin ${binId} or expired`, HttpStatus.NOT_FOUND);
//         }
//
//         // Calculate locations
//         const locations: Location[] = [];
//         let quantityCalc = 0;
//
//         for (const device of devices) {
//           let location: Location = {
//             cabinet: {
//               id: binData.cabinet._id.toString(),
//               name: binData.cabinet.name,
//             },
//             bin: {
//               id: binData._id.toString(),
//               name: binData.name,
//               row: binData.row.toString(),
//             },
//           };
//
//           // Check if location exists in return items
//           if (returnItem && returnItem.locations) {
//             const existingLocation = returnItem.locations.find((loc: any) => loc.bin.id === location.bin.id);
//             if (existingLocation) {
//               location = {
//                 ...location,
//                 quantity: existingLocation.quantity,
//                 preQty: existingLocation.preQty,
//                 requestQty: existingLocation.requestQty,
//               };
//             }
//           }
//
//           location.preQty = device.quantity;
//           locations.push(location);
//
//           // Calculate request quantity for this location
//           if (quantity - quantityCalc > device.quantity) {
//             quantityCalc += parseInt(device.quantity.toString());
//             location.requestQty = parseInt(device.quantity.toString());
//           } else {
//             location.requestQty = parseInt(quantity.toString()) - parseInt(quantityCalc.toString());
//             break;
//           }
//         }
//
//         // Format list WO if exists
//         let formatListWO = [];
//         if (listWO && listWO.length > 0) {
//           formatListWO = listWO
//             .map((wo) => {
//               const jobCard = jobCardsMap.get(wo.woId);
//               const area = areasMap.get(wo.areaId);
//
//               if (!jobCard || !area) {
//                 return null;
//               }
//
//               return {
//                 woId: jobCard._id,
//                 wo: jobCard.wo,
//                 vehicleId: jobCard.vehicleId,
//                 platform: jobCard.platform,
//                 areaId: area._id,
//                 torq: area.torque,
//                 area: area.name,
//               };
//             })
//             .filter((item) => item !== null);
//
//           if (!formatListWO.length) {
//             throw new HttpException('Wrong format for list WO', HttpStatus.BAD_REQUEST);
//           }
//         }
//
//         result.push({
//           id: itemData._id,
//           name: itemData.name,
//           itemTypeId: itemData.itemTypeId,
//           type: itemData.type,
//           partNo: itemData.partNo,
//           materialNo: itemData.materialNo,
//           locations,
//           listWO: formatListWO || [],
//         });
//       }
//
//       // Format data with optimized queries
//       const formatData = await this.formatDataOptimized(result, devicesMap, itemsMap);
//
//       // Create process item
//       await this.processItemService.createProcessItemByRequest(
//         token,
//         PROCESS_ITEM_TYPE.ISSUE,
//         JSON.stringify(currentUser),
//         JSON.stringify(formatData),
//         requestQty,
//         uniqueId,
//       );
//
//       return { success: true, data: result, formatData };
//     } catch (error) {
//       console.error('[ItemService][issue] error:', error);
//       throw error;
//     }
//   }
//
//   private async formatDataOptimized(data: any[], devicesMap: Map<string, Device[]>, itemsMap: Map<string, any>) {
//     const itemsByBin: any = {};
//
//     // Group by bin
//     data.forEach((item) => {
//       item.locations.forEach((location: Location) => {
//         const binId = location.bin.id;
//
//         if (!itemsByBin[binId]) {
//           itemsByBin[binId] = {
//             cabinet: location.cabinet,
//             bin: location.bin,
//             requestItems: [],
//             storageItems: [],
//           };
//         }
//
//         const itemData: any = {
//           id: item.id,
//           name: item.name,
//           itemTypeId: item.itemTypeId,
//           type: item.type,
//           partNo: item.partNo,
//           materialNo: item.materialNo,
//           requestQty: location.requestQty,
//           preQty: location.preQty,
//           conditionId: null,
//         };
//
//         if (item.listWO && item.listWO.length) {
//           itemData.listWO = item.listWO;
//         }
//
//         if (item.conditionId || item.conditionId === 0) {
//           itemData.conditionId = item.conditionId;
//         }
//
//         itemsByBin[binId].requestItems.push(itemData);
//       });
//     });
//
//     // Get all unique bin IDs for storage items query
//     const binIds = Object.keys(itemsByBin);
//
//     // Batch fetch all devices for all bins
//     const allDevices = await this.deviceModel.find({
//       binId: { $in: binIds.map((id) => new Types.ObjectId(id)) },
//     });
//
//     // Group devices by binId
//     const devicesByBin = new Map<string, Device[]>();
//     allDevices.forEach((device) => {
//       const binId = device.binId.toString();
//       if (!devicesByBin.has(binId)) {
//         devicesByBin.set(binId, []);
//       }
//       devicesByBin.get(binId).push(device);
//     });
//
//     // Process storage items for each bin
//     for (const [binId, binData] of Object.entries(itemsByBin)) {
//       const itemIds = binData.requestItems.map((item: any) => item.id.toString());
//       const devicesInBin = devicesByBin.get(binId) || [];
//
//       for (const device of devicesInBin) {
//         if (!device.itemId || itemIds.includes(device.itemId.toString())) {
//           continue;
//         }
//
//         const item = itemsMap.get(device.itemId.toString());
//         if (!item) {
//           continue;
//         }
//
//         const itemData = {
//           id: item._id,
//           name: item.name,
//           itemTypeId: item.itemTypeId,
//           type: item.type,
//           partNo: item.partNo,
//           materialNo: item.materialNo,
//           requestQty: 0,
//           preQty: device.quantity || 0,
//           status: null,
//         };
//
//         binData.storageItems.push(itemData);
//       }
//     }
//
//     return Object.values(itemsByBin);
//   }
// }
