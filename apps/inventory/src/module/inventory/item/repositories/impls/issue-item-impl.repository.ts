import { and, MongoQueryBuilder, or, where } from '@dals/mongo';
import { AreaMRepository, DeviceMRepository, ItemMRepository, JobCardMRepository, ReturnItemMRepository } from '@dals/mongo/repositories';
import { BinItem } from '@dals/mongo/schema/bin-item.schema';
import { Bin } from '@dals/mongo/schema/bin.schema';
import { Cabinet } from '@dals/mongo/schema/cabinet.schema';
import { Device } from '@dals/mongo/schema/device.schema';
import { Item } from '@dals/mongo/schema/item.schema';
import { LocationItem, ReturnItemEntity } from '@entity';
import { ItemMapper, ReturnItemMapper } from '@mapper';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { FormattedData, FormattedWO, IssuedItem, ItemsByBin, RequestIssueItem, RequestWorkOrderItem } from '../types';

type AggregatedCabinet = Omit<Cabinet, 'id' | '_id'> & {
  _id: Types.ObjectId;
};

type AggregatedBin = Omit<Bin, 'id' | '_id' | 'cabinetId'> & {
  _id: Types.ObjectId;
  cabinetId: Types.ObjectId;
  cabinet: AggregatedCabinet;
  binItems: BinItem[];
};

type AggregatedDevice = Omit<Device, 'id' | '_id' | 'portId' | 'binId' | 'itemId'> & {
  _id: Types.ObjectId;
  binId: Types.ObjectId;
  itemId: Types.ObjectId;
  bin: AggregatedBin;
};

type ItemWithDevicesAggregationResult = Omit<Item, 'id' | '_id' | 'itemTypeId'> & {
  id: Types.ObjectId;
  itemTypeId: Types.ObjectId;
  devices: AggregatedDevice[];
};

const ERRORS = {
  ITEM_NOT_FOUND_IN_DEVICE: (itemId: string) => `Item with ID ${itemId} not found in any active, non-expired device for the specified bin.`,
  WRONG_WO_FORMAT: 'The listWO format is incorrect or contains invalid IDs.',
};

@Injectable()
export class IssueItemImplRepository {
  constructor(
    private readonly _itemRepository: ItemMRepository,
    private readonly _deviceRepository: DeviceMRepository,
    private readonly _returnItemRepository: ReturnItemMRepository,
    private readonly _jobCardRepository: JobCardMRepository,
    private readonly _areaRepository: AreaMRepository,
  ) {}

  public async getIssueItems(
    userId: string,
    items: RequestIssueItem[],
  ): Promise<{
    success: boolean;
    data: IssuedItem[];
    formattedData: FormattedData[];
    requestQty: number;
  }> {
    const dateThreshold = new Date();
    dateThreshold.setHours(0, 0, 0, 0);

    const processItemPromises: Promise<IssuedItem>[] = items.map(async (item) =>
      this._processSingleItemForIssue(item, userId, dateThreshold),
    );
    const issuedItems: IssuedItem[] = await Promise.all(processItemPromises);

    const formattedData: FormattedData[] = await this._formatIssueData(issuedItems);
    const totalRequestQty: number = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      success: true,
      data: issuedItems,
      formattedData,
      requestQty: totalRequestQty,
    };
  }

  private async _processSingleItemForIssue(item: RequestIssueItem, processBy: string, dateThreshold: Date): Promise<IssuedItem> {
    const { itemId, quantity, listWO, binId } = item;

    const aggregationResult = await this._itemRepository.aggregate<ItemWithDevicesAggregationResult>([
      { $match: MongoQueryBuilder.build(where('_id').eq(new Types.ObjectId(itemId))) },
      { $lookup: { from: 'devices', localField: '_id', foreignField: 'itemId', as: 'devices' } },
      { $unwind: '$devices' },
      { $match: MongoQueryBuilder.build(and(where('devices.quantity').gt(0), where('devices.binId').eq(new Types.ObjectId(binId)))) },
      { $lookup: { from: 'bins', localField: 'devices.binId', foreignField: '_id', as: 'devices.bin' } },
      { $unwind: '$devices.bin' },
      // Lookup binItems from the bin, then match against it
      { $lookup: { from: 'binitems', localField: 'devices.bin._id', foreignField: 'binId', as: 'devices.bin.binItems' } },
      { $unwind: '$devices.bin.binItems' }, // Unwind binItems to match individual bin items
      {
        $match: MongoQueryBuilder.build(
          and(
            where('devices.bin.isFailed').eq(false),
            where('devices.bin.isDamage').eq(false),
            // Ensure the binItem matches the current itemId being processed
            where('devices.bin.binItems.itemId').eq(new Types.ObjectId(itemId)),
            or(where('devices.bin.binItems.expiryDate').gte(dateThreshold), where('devices.bin.binItems.expiryDate').eq(null)),
          ),
        ),
      },
      { $lookup: { from: 'cabinets', localField: 'devices.bin.cabinetId', foreignField: '_id', as: 'devices.bin.cabinet' } },
      { $unwind: '$devices.bin.cabinet' },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          itemTypeId: { $first: '$itemTypeId' },
          type: { $first: '$type' },
          partNo: { $first: '$partNo' },
          materialNo: { $first: '$materialNo' },
          devices: { $push: '$devices' },
        },
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: 1,
          itemTypeId: 1,
          type: 1,
          partNo: 1,
          materialNo: 1,
          devices: 1,
        },
      },
    ]);

    const itemWithDevices = aggregationResult[0];

    if (!itemWithDevices || itemWithDevices.devices.length === 0) {
      throw new NotFoundException(ERRORS.ITEM_NOT_FOUND_IN_DEVICE(itemId));
    }

    const returnItemDoc = await this._returnItemRepository.findFirst(
      MongoQueryBuilder.build(and(where('userId').eq(processBy), where('itemId').eq(itemWithDevices.id))),
    );
    const returnItem: ReturnItemEntity | null = returnItemDoc ? ReturnItemMapper.toEntity(returnItemDoc) : null;

    let quantityCalc = 0;
    const locations: LocationItem[] = [];

    for (const device of itemWithDevices.devices) {
      if (quantityCalc >= quantity) {
        break;
      }

      const { cabinet, ...bin } = device.bin;
      let location: LocationItem = {
        cabinet: { id: cabinet._id.toString(), name: cabinet.name },
        bin: { id: bin._id.toString(), name: bin.name, row: bin.row },
        preQty: device.quantity,
        requestQty: 0,
      };

      if (returnItem) {
        const foundLocation = returnItem.locations.find((loc) => loc.bin.id.toString() === bin._id.toString());
        if (foundLocation) {
          location = { ...location, ...foundLocation };
        }
      }

      const remainingQtyNeeded = quantity - quantityCalc;
      const qtyToTake = Math.min(remainingQtyNeeded, device.quantity);

      location.requestQty = qtyToTake;
      quantityCalc += qtyToTake;

      locations.push(location);
    }

    const formattedListWO: FormattedWO[] = await this._formatListWO(listWO);

    return {
      ...ItemMapper.toEntity(itemWithDevices),
      locations,
      listWO: formattedListWO,
    };
  }

  private async _formatIssueData(issuedItems: IssuedItem[]): Promise<FormattedData[]> {
    const itemsByBin: ItemsByBin = {};

    issuedItems.forEach((item) => {
      item.locations.forEach((location) => {
        const binId = location.bin.id.toString();
        if (!itemsByBin[binId]) {
          itemsByBin[binId] = {
            cabinet: location.cabinet,
            bin: location.bin,
            requestItems: [],
            storageItems: [],
            requestedItemIds: new Set<string>(),
          };
        }
        const requestItemData = {
          id: item.id,
          name: item.name,
          itemTypeId: item.itemTypeId,
          type: item.type,
          partNo: item.partNo,
          materialNo: item.materialNo,
          requestQty: location.requestQty,
          preQty: location.preQty,
          listWO: item.listWO,
        };
        itemsByBin[binId].requestItems.push(requestItemData);
        itemsByBin[binId].requestedItemIds.add(item.id.toString());
      });
    });

    const allBinIds = Object.keys(itemsByBin).map((id) => new Types.ObjectId(id));
    if (allBinIds.length === 0) {
      return [];
    }

    const allDevicesInRelevantBins = await this._deviceRepository.findMany(MongoQueryBuilder.build(where('binId').in(allBinIds)), {
      populate: 'itemId',
      lean: false,
    });

    allDevicesInRelevantBins.forEach((deviceDoc) => {
      const binId = deviceDoc.binId;
      const itemId = deviceDoc.itemId;

      if (itemsByBin[binId] && !itemsByBin[binId].requestedItemIds.has(itemId)) {
        if ('item' in deviceDoc && !!deviceDoc.item) {
          const item = deviceDoc['item'] as Item;
          itemsByBin[binId].storageItems.push({
            id: item._id.toString(),
            name: item.name,
            itemTypeId: item.itemTypeId,
            type: item.type,
            partNo: item.partNo,
            materialNo: item.materialNo,
            requestQty: 0,
            preQty: deviceDoc.quantity,
          });
        }
      }
    });

    return Object.values(itemsByBin).map(({ requestedItemIds, ...rest }) => rest);
  }

  private async _formatListWO(listWO: RequestWorkOrderItem[]): Promise<FormattedWO[]> {
    if (!listWO || listWO.length === 0) {
      return [];
    }

    const jobCardIds = Array.from(new Set(listWO.map((item) => item.woId)));
    const areaIds = Array.from(new Set(listWO.map((item) => item.areaId)));

    const [jobCardDocs, areaDocs] = await Promise.all([
      this._jobCardRepository.findMany(MongoQueryBuilder.build(where('_id').in(jobCardIds))),
      this._areaRepository.findMany(MongoQueryBuilder.build(where('_id').in(areaIds))),
    ]);

    const jobCardsMap = new Map(jobCardDocs.map((doc) => [doc._id.toString(), doc]));
    const areasMap = new Map(areaDocs.map((doc) => [doc._id.toString(), doc]));

    const result = listWO.map((item): FormattedWO | null => {
      const jobCard = jobCardsMap.get(item.woId);
      const area = areasMap.get(item.areaId);
      if (!jobCard || !area) {
        return null;
      }

      return {
        woId: jobCard._id.toString(),
        wo: jobCard.wo,
        vehicleId: jobCard.vehicleId,
        platform: jobCard.platform,
        areaId: area._id.toString(),
        torq: area.torque,
        area: area.name,
      };
    });

    const filteredResult = result.filter((item): item is FormattedWO => item !== null);
    if (filteredResult.length !== listWO.length) {
      throw new BadRequestException(ERRORS.WRONG_WO_FORMAT);
    }

    return filteredResult;
  }
}
