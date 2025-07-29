import { and, MongoQueryBuilder, where } from '@dals/mongo';
import { AreaMRepository, DeviceMRepository, ItemMRepository, JobCardMRepository, ReturnItemMRepository } from '@dals/mongo/repositories';
import { ReturnItemEntity } from '@entity';
import { ItemMapper, ReturnItemMapper } from '@mapper';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { FormattedData, FormattedWO, IssuedItem, RequestReturnItem, RequestWorkOrderItem } from '../types';

const ERRORS = {
  RETURN_ITEM_NOT_FOUND: (itemId: string, userId: string, binId: string) =>
    `Return item not found for itemId: ${itemId}, userId: ${userId}, binId: ${binId}`,
  ITEM_NOT_FOUND: (itemId: string) => `Item with ID ${itemId} not found.`,
  WRONG_WO_FORMAT: 'The listWO format is incorrect or contains invalid IDs.',
};

@Injectable()
export class ReturnItemImplRepository {
  constructor(
    private readonly _itemRepository: ItemMRepository,
    private readonly _deviceRepository: DeviceMRepository,
    private readonly _returnItemRepository: ReturnItemMRepository,
    private readonly _jobCardRepository: JobCardMRepository,
    private readonly _areaRepository: AreaMRepository,
  ) {}

  public async getReturnItems(
    userId: string,
    items: RequestReturnItem[],
  ): Promise<{
    success: boolean;
    data: IssuedItem[];
    formattedData: FormattedData[];
    requestQty: number;
  }> {
    const processItemPromises: Promise<IssuedItem>[] = items.map(async (item) => this._processSingleItemForReturn(item, userId));
    const returnedItems: IssuedItem[] = await Promise.all(processItemPromises);

    const formattedData: FormattedData[] = await this._formatIssueData(returnedItems);
    const totalRequestQty: number = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      success: true,
      data: returnedItems,
      formattedData,
      requestQty: totalRequestQty,
    };
  }

  private async _processSingleItemForReturn(item: RequestReturnItem, userId: string): Promise<IssuedItem> {
    const { itemId, quantity, conditionId, listWO, binId } = item;
    const returnItemDoc = await this._returnItemRepository.findFirst(
      MongoQueryBuilder.build(
        and(where('itemId').eq(new Types.ObjectId(itemId)), where('userId').eq(userId), where('binId').eq(new Types.ObjectId(binId))),
      ),
    );

    if (!returnItemDoc) {
      throw new NotFoundException(ERRORS.RETURN_ITEM_NOT_FOUND(itemId, userId, binId));
    }

    const returnItem = ReturnItemMapper.toEntity(returnItemDoc) as ReturnItemEntity;

    const existedItemDoc = await this._itemRepository.findById(new Types.ObjectId(itemId));
    if (!existedItemDoc) {
      throw new NotFoundException(ERRORS.ITEM_NOT_FOUND(itemId));
    }

    const existedItem = ItemMapper.toEntity(existedItemDoc);

    let quantityCalc = 0;
    const locations = [];

    // Process locations
    for (const location of returnItem.locations) {
      if (location.quantity === 0) {
        continue;
      }

      const deviceDoc = await this._deviceRepository.findFirst(
        MongoQueryBuilder.build(
          and(where('binId').eq(new Types.ObjectId(location.bin.id)), where('itemId').eq(new Types.ObjectId(returnItem.itemId))),
        ),
      );

      if (!deviceDoc) {
        continue;
      }

      const remainingQuantityNeeded = quantity - quantityCalc;

      if (location.quantity - remainingQuantityNeeded >= 0) {
        location.quantity = location.quantity - remainingQuantityNeeded;
        quantityCalc = quantity;
        returnItem.quantity = returnItem.quantity - quantity;
        location.requestQty = quantity;
        location.preQty = parseInt(deviceDoc.quantity.toString());
        locations.push(location);
        break;
      } else {
        quantityCalc += location.quantity;
        location.requestQty = location.quantity;
        locations.push(location);
      }
    }

    const formattedListWO: FormattedWO[] = await this._formatListWO(listWO || []);

    return {
      id: existedItem.id,
      name: existedItem.name,
      itemTypeId: existedItem.itemTypeId,
      type: existedItem.type,
      partNo: existedItem.partNo,
      materialNo: existedItem.materialNo,
      locations,
      conditionId,
      listWO: formattedListWO,
    };
  }

  private async _formatIssueData(returnedItems: IssuedItem[]): Promise<FormattedData[]> {
    // Sử dụng lại method _formatIssueData hiện có
    // Method này đã được implement trong class khác, chỉ cần gọi lại
    const itemsByBin = {};

    returnedItems.forEach((item) => {
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
          const item = deviceDoc['item'] as any;
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

    return Object.values(itemsByBin).map(({ requestedItemIds, ...rest }: any) => rest);
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
