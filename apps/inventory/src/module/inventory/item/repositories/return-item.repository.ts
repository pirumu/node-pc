import { PaginatedResult, PaginationMeta } from '@common/dto';
import { IssueHistoryEntity } from '@dals/mongo/entities';
import { ObjectId, EntityManager } from '@mikro-orm/mongodb';
import { Injectable, Logger } from '@nestjs/common';

import { FindReturnableItemsParams, ReturnableItemRecord } from './item.types';

@Injectable()
export class ReturnItemRepository {
  private readonly _logger = new Logger(ReturnItemRepository.name);

  constructor(private readonly _em: EntityManager) {}

  public async findReturnableItemsLegacy(params: FindReturnableItemsParams): Promise<PaginatedResult<ReturnableItemRecord>> {
    const { userId, page, limit, keyword, itemTypeId } = params;

    const pipeline: any[] = [];

    pipeline.push({
      $match: {
        userId: new ObjectId(userId),
        ['locations.0']: { $exists: true },
      },
    });
    pipeline.push({ $unwind: '$locations' });
    pipeline.push({ $lookup: { from: 'items', localField: 'itemId', foreignField: '_id', as: 'item' } }, { $unwind: '$item' });
    pipeline.push(
      { $lookup: { from: 'item_types', localField: 'item.itemTypeId', foreignField: '_id', as: 'item.itemType' } },
      { $unwind: '$item.itemType' },
    );
    pipeline.push(
      { $lookup: { from: 'loadcells', localField: 'locations.loadcellId', foreignField: '_id', as: 'loadcell' } },
      { $unwind: '$loadcell' },
    );
    pipeline.push({ $lookup: { from: 'bins', localField: 'loadcell.binId', foreignField: '_id', as: 'bin' } }, { $unwind: '$bin' });
    pipeline.push(
      { $lookup: { from: 'cabinets', localField: 'bin.cabinetId', foreignField: '_id', as: 'cabinet' } },
      { $unwind: '$cabinet' },
    );

    const secondaryMatch: any = {};
    if (keyword) {
      secondaryMatch.$or = [{ ['item.name']: { $regex: keyword, $options: 'i' } }, { ['item.partNo']: { $regex: keyword, $options: 'i' } }];
    }
    if (itemTypeId) {
      secondaryMatch['item.itemType._id'] = new ObjectId(itemTypeId);
    }
    if (Object.keys(secondaryMatch).length > 0) {
      pipeline.push({ $match: secondaryMatch });
    }

    pipeline.push({
      $group: {
        _id: {
          itemId: '$item._id',
          binId: '$bin._id',
        },

        name: { $first: '$item.name' },
        partNo: { $first: '$item.partNo' },
        materialNo: { $first: '$item.materialNo' },
        itemTypeId: { $first: '$item.itemType._id' },
        type: { $first: '$item.itemType.name' },
        image: { $first: '$item.itemImage' },
        description: { $first: '$item.description' },
        location: {
          $first: {
            $concat: ['$cabinet.name', '-', { $toString: '$bin.x' }, '-', { $toString: '$bin.y' }],
          },
        },

        loadcellDetails: {
          $push: {
            batchNumber: '$loadcell.metadata.batchNumber',
            serialNumber: '$loadcell.metadata.serialNumber',
            dueDate: '$loadcell.metadata.expiryDate',
          },
        },

        issuedQuantityInBin: { $sum: '$locations.quantity' },
      },
    });

    pipeline.push({
      $project: {
        _id: 0,
        id: '$_id.itemId',
        binId: '$_id.binId',
        name: 1,
        partNo: 1,
        materialNo: 1,
        itemTypeId: 1,
        type: 1,
        image: 1,
        description: 1,
        location: 1,
        issuedQuantity: '$issuedQuantityInBin',
        itemInfo: '$loadcellDetails',
        workingOrders: [],
      },
    });

    const countPipeline = [...pipeline, { $count: 'total' }];

    try {
      const dataPipeline = [...pipeline, { $sort: { name: 1, location: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }];

      const [totalResult, rows] = await Promise.all([
        this._em.aggregate(IssueHistoryEntity, countPipeline),
        this._em.aggregate(IssueHistoryEntity, dataPipeline),
      ]);

      const total = totalResult.length > 0 ? totalResult[0].total : 0;

      return new PaginatedResult(
        rows as ReturnableItemRecord[],
        new PaginationMeta({
          total,
          page,
          limit,
        }),
      );
    } catch (error) {
      this._logger.error('Failed to find returnable items using aggregate:', error);
      throw error;
    }
  }

  public async findReturnableItems(params: FindReturnableItemsParams): Promise<PaginatedResult<ReturnableItemRecord>> {
    const { userId, page, limit, keyword, itemTypeId } = params;

    const mainPipeline: any[] = [
      {
        $match: {
          userId: new ObjectId(userId),
          'locations.0': { $exists: true },
        },
      },
      { $lookup: { from: 'items', localField: 'itemId', foreignField: '_id', as: 'item' } },
      { $unwind: '$item' },
      { $lookup: { from: 'item_types', localField: 'item.itemTypeId', foreignField: '_id', as: 'item.itemType' } },
      { $unwind: '$item.itemType' },

      {
        $facet: {
          // --- Nhánh 1: Xử lý các item từ Loadcell (Không đổi) ---
          fromLoadcells: [
            { $unwind: '$locations' },
            { $match: { 'locations.loadcellId': { $ne: null } } },
            { $lookup: { from: 'loadcells', localField: 'locations.loadcellId', foreignField: '_id', as: 'loadcell' } },
            { $unwind: '$loadcell' },
            { $lookup: { from: 'bins', localField: 'loadcell.binId', foreignField: '_id', as: 'bin' } },
            { $unwind: '$bin' },
            {
              $project: {
                itemId: '$item._id',
                binId: '$bin._id',
                item: '$item',
                bin: '$bin',
                issuedQuantity: '$locations.quantity',
                itemInfo: {
                  batchNumber: '$loadcell.metadata.batchNumber',
                  serialNumber: '$loadcell.metadata.serialNumber',
                  dueDate: '$loadcell.metadata.expiryDate',
                },
              },
            },
          ],
          // --- Nhánh 2: Xử lý các item từ Bin thường (Đã cập nhật logic) ---
          fromNormalBins: [
            { $unwind: '$locations' },
            { $match: { 'locations.loadcellId': null, 'locations.binId': { $ne: null } } },
            { $lookup: { from: 'bins', localField: 'locations.binId', foreignField: '_id', as: 'bin' } },
            { $unwind: '$bin' },

            // [SỬA LỖI] Mở mảng items trong bin để tìm đúng thông tin
            { $unwind: '$bin.items' },

            // [SỬA LỖI] So khớp item trong mảng với item đã được cấp phát
            {
              $match: {
                $expr: { $eq: ['$bin.items.itemId', '$itemId'] },
              },
            },

            {
              $project: {
                itemId: '$item._id',
                binId: '$bin._id',
                item: '$item',
                bin: '$bin', // Giữ lại bin gốc, không phải bin.items
                issuedQuantity: '$locations.quantity',
                // [SỬA LỖI] Lấy thông tin từ bin.items đã được lọc
                itemInfo: {
                  batchNumber: '$bin.items.batchNumber',
                  serialNumber: '$bin.items.serialNumber',
                  dueDate: '$bin.items.expiryDate', // Lấy từ đây sẽ chính xác hơn
                },
              },
            },
          ],
        },
      },

      {
        $project: {
          allItems: { $concatArrays: ['$fromLoadcells', '$fromNormalBins'] },
        },
      },
      { $unwind: '$allItems' },
      { $replaceRoot: { newRoot: '$allItems' } },

      { $lookup: { from: 'cabinets', localField: 'bin.cabinetId', foreignField: '_id', as: 'cabinet' } },
      { $unwind: '$cabinet' },

      {
        $match: {
          ...((keyword && {
            $or: [{ 'item.name': { $regex: keyword, $options: 'i' } }, { 'item.partNo': { $regex: keyword, $options: 'i' } }],
          }) ||
            {}),
          ...((itemTypeId && { 'item.itemType._id': new ObjectId(itemTypeId) }) || {}),
        },
      },

      {
        $group: {
          _id: {
            itemId: '$itemId',
            binId: '$binId',
          },
          name: { $first: '$item.name' },
          partNo: { $first: '$item.partNo' },
          materialNo: { $first: '$item.materialNo' },
          itemTypeId: { $first: '$item.itemType._id' },
          type: { $first: '$item.itemType.name' },
          image: { $first: '$item.itemImage' },
          description: { $first: '$item.description' },
          location: {
            $first: {
              $concat: ['$cabinet.name', '-', { $toString: '$bin.x' }, '-', { $toString: '$bin.y' }],
            },
          },
          itemInfo: { $push: '$itemInfo' },
          issuedQuantityInBin: { $sum: '$issuedQuantity' },
        },
      },

      {
        $project: {
          _id: 0,
          id: '$_id.itemId',
          binId: '$_id.binId',
          name: 1,
          partNo: 1,
          materialNo: 1,
          itemTypeId: 1,
          type: 1,
          image: 1,
          description: 1,
          location: 1,
          issuedQuantity: '$issuedQuantityInBin',
          itemInfo: '$itemInfo',
          workingOrders: [],
        },
      },
    ];

    try {
      const countPipeline = [...mainPipeline, { $count: 'total' }];
      const dataPipeline = [...mainPipeline, { $sort: { name: 1, location: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }];

      const [totalResult, rows] = await Promise.all([
        this._em.aggregate(IssueHistoryEntity, countPipeline),
        this._em.aggregate(IssueHistoryEntity, dataPipeline),
      ]);

      const total = totalResult.length > 0 ? totalResult[0].total : 0;

      return new PaginatedResult(rows as ReturnableItemRecord[], new PaginationMeta({ total, page, limit }));
    } catch (error) {
      this._logger.error('Failed to find returnable items using aggregate:', error);
      throw error;
    }
  }
}
