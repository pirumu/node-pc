import { PaginatedResult, PaginationMeta } from '@common/dto';
import { BinEntity, IssueHistoryEntity, ItemEntity, LoadcellEntity } from '@dals/mongo/entities';
import { RefHelper } from '@dals/mongo/helpers';
import { EntityManager, FilterQuery, ObjectId } from '@mikro-orm/mongodb';
import { Injectable, Logger } from '@nestjs/common';

import { FindIssuableItemsParams, IssuableItemRecord, ItemsForIssueInput } from './item.types';

@Injectable()
export class IssueItemRepository {
  private readonly _logger = new Logger(IssueItemRepository.name);

  constructor(private readonly _em: EntityManager) {}

  public async findIssuableItemsLegacy(params: FindIssuableItemsParams): Promise<PaginatedResult<IssuableItemRecord>> {
    const { page, limit, keyword, itemTypeId, expiryDate } = params;

    const pipeline: any[] = [];

    pipeline.push({ $lookup: { from: 'items', localField: 'itemId', foreignField: '_id', as: 'item' } }, { $unwind: '$item' });
    pipeline.push(
      { $lookup: { from: 'item_types', localField: 'item.itemTypeId', foreignField: '_id', as: 'item.itemType' } },
      { $unwind: '$item.itemType' },
    );
    pipeline.push({ $lookup: { from: 'bins', localField: 'binId', foreignField: '_id', as: 'bin' } }, { $unwind: '$bin' });
    pipeline.push({ $lookup: { from: 'cabinets', localField: 'cabinetId', foreignField: '_id', as: 'cabinet' } }, { $unwind: '$cabinet' });

    const matchConditions: any = { ['state.isCalibrated']: true };
    if (keyword) {
      matchConditions.$or = [
        { ['item.name']: { $regex: keyword, $options: 'i' } },
        { ['item.partNo']: { $regex: keyword, $options: 'i' } },
      ];
    }
    if (itemTypeId) {
      matchConditions['item.itemType._id'] = new ObjectId(itemTypeId);
    }
    pipeline.push({ $match: matchConditions });

    pipeline.push({
      $addFields: {
        binName: {
          $concat: ['$cabinet.name', ',', { $toString: '$bin.index' }, '-', { $toString: '$bin.x' }],
        },
        canIssue: {
          $and: [
            { $gt: ['$availableQuantity', 0] },
            { $eq: ['$bin.state.isFailed', false] },
            { $eq: ['$bin.state.isDamaged', false] },
            { $or: [{ $eq: ['$metadata.expiryDate', null] }, { $gte: ['$metadata.expiryDate', new Date(expiryDate)] }] },
          ],
        },
      },
    });

    pipeline.push({
      $sort: {
        canIssue: -1,
        ['metadata.expiryDate']: -1,
        availableQuantity: -1,
      },
    });

    pipeline.push({
      $group: {
        _id: {
          itemId: '$item._id',
          binId: '$bin._id',
        },
        totalQuantity: { $sum: '$availableQuantity' },
        totalCalcQuantity: { $sum: '$calibration.calibratedQuantity' },
        item: { $first: '$item' },
        bin: { $first: '$bin' },
        cabinet: { $first: '$cabinet' },
        binName: { $first: '$binName' },
        dueDate: { $first: '$metadata.expiryDate' },
        canIssue: { $max: '$canIssue' },
        loadcellCount: { $sum: 1 },
      },
    });

    pipeline.push({
      $project: {
        _id: 0,
        id: '$item._id',
        binId: '$bin._id',
        name: '$item.name',
        partNo: '$item.partNo',
        materialNo: '$item.materialNo',
        itemTypeId: '$item.itemType._id',
        type: '$item.itemType.name',
        image: '$item.itemImage',
        description: '$item.description',
        totalQuantity: '$totalQuantity',
        totalCalcQuantity: '$totalCalcQuantity',
        binName: '$binName',
        dueDate: '$dueDate',
        canIssue: '$canIssue',
        loadcellCount: '$loadcellCount',
      },
    });

    const countPipeline = [...pipeline, { $count: 'total' }];

    try {
      const dataPipeline = [...pipeline, { $sort: { name: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }];

      const [totalResult, rows] = await Promise.all([
        this._em.aggregate(LoadcellEntity, countPipeline),
        this._em.aggregate(LoadcellEntity, dataPipeline),
      ]);

      const total = totalResult.length > 0 ? totalResult[0].total : 0;

      return new PaginatedResult(
        rows,
        new PaginationMeta({
          total,
          page,
          limit,
        }),
      );
    } catch (error) {
      this._logger.error('Failed to find issuable items using aggregate:', error);
      throw error;
    }
  }

  public async findIssuableItems(params: FindIssuableItemsParams): Promise<PaginatedResult<IssuableItemRecord>> {
    const { page, limit, keyword, itemTypeId, expiryDate } = params;

    const loadcellItemsPipeline = [
      { $lookup: { from: 'items', localField: 'itemId', foreignField: '_id', as: 'item' } },
      { $unwind: '$item' },
      { $lookup: { from: 'item_types', localField: 'item.itemTypeId', foreignField: '_id', as: 'item.itemType' } },
      { $unwind: '$item.itemType' },
      { $lookup: { from: 'bins', localField: 'binId', foreignField: '_id', as: 'bin' } },
      { $unwind: '$bin' },
      { $lookup: { from: 'cabinets', localField: 'bin.cabinetId', foreignField: '_id', as: 'cabinet' } },
      { $unwind: '$cabinet' },
      { $match: { ['state.isCalibrated']: true } },
      {
        $project: {
          _id: 0,
          itemId: '$item._id',
          binId: '$bin._id',
          availableQuantity: '$availableQuantity',
          expiryDate: '$metadata.expiryDate',
          item: '$item',
          bin: '$bin',
          cabinet: '$cabinet',
          calibratedQuantity: '$calibration.calibratedQuantity',
          isLoadcell: true,
        },
      },
    ];

    const mainPipeline: any[] = [
      { $unwind: '$items' },

      { $lookup: { from: 'items', localField: 'items.itemId', foreignField: '_id', as: 'item' } },
      { $unwind: '$item' },
      { $lookup: { from: 'item_types', localField: 'item.itemTypeId', foreignField: '_id', as: 'item.itemType' } },
      { $unwind: '$item.itemType' },
      { $lookup: { from: 'cabinets', localField: 'cabinetId', foreignField: '_id', as: 'cabinet' } },
      { $unwind: '$cabinet' },
      {
        $addFields: {
          bin: '$$ROOT',
          calibratedQuantity: 0,
          isLoadcell: false,
        },
      },
      {
        $project: {
          _id: 0,
          itemId: '$item._id',
          binId: '$bin._id',
          availableQuantity: '$items.qty',
          expiryDate: '$items.expiryDate',
          item: '$item',
          bin: '$bin',
          cabinet: '$cabinet',
          calibratedQuantity: '$calibratedQuantity',
          isLoadcell: '$isLoadcell',
        },
      },

      {
        $unionWith: {
          coll: 'loadcells',
          pipeline: loadcellItemsPipeline,
        },
      },

      {
        $match: {
          ...(keyword && {
            $or: [{ ['item.name']: { $regex: keyword, $options: 'i' } }, { ['item.partNo']: { $regex: keyword, $options: 'i' } }],
          }),
          ...(itemTypeId && { ['item.itemType._id']: new ObjectId(itemTypeId) }),
        },
      },
      {
        $addFields: {
          binName: {
            $concat: ['$cabinet.name', ',', { $toString: '$bin.row' }, '-', { $toString: '$bin.index' }],
          },
          canIssue: {
            $and: [
              { $gt: ['$availableQuantity', 0] },
              { $eq: ['$bin.state.isFailed', false] },
              { $eq: ['$bin.state.isDamaged', false] },
              { $or: [{ $eq: ['$expiryDate', null] }, { $gte: ['$expiryDate', new Date(expiryDate)] }] },
            ],
          },
        },
      },
      {
        $group: {
          _id: { itemId: '$itemId', binId: '$binId' },
          totalQuantity: { $sum: '$availableQuantity' },
          totalCalcQuantity: { $sum: '$calibratedQuantity' },
          loadcellCount: { $sum: { $cond: ['$isLoadcell', 1, 0] } },
          item: { $first: '$item' },
          bin: { $first: '$bin' },
          cabinet: { $first: '$cabinet' },
          binName: { $first: '$binName' },
          dueDate: { $first: '$expiryDate' },
          canIssue: { $max: '$canIssue' },
        },
      },
      {
        $project: {
          _id: 0,
          id: '$item._id',
          binId: '$bin._id',
          name: '$item.name',
          partNo: '$item.partNo',
          materialNo: '$item.materialNo',
          itemTypeId: '$item.itemType._id',
          type: '$item.itemType.name',
          image: '$item.itemImage',
          description: '$item.description',
          totalQuantity: '$totalQuantity',
          totalCalcQuantity: '$totalCalcQuantity',
          binName: '$binName',
          dueDate: '$dueDate',
          canIssue: '$canIssue',
          loadcellCount: '$loadcellCount',
        },
      },
    ];

    try {
      const countPipeline = [...mainPipeline, { $count: 'total' }];
      const dataPipeline = [
        ...mainPipeline,
        { $sort: { canIssue: -1, dueDate: -1, totalQuantity: -1, name: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ];

      const [totalResult, rows] = await Promise.all([
        this._em.aggregate(BinEntity, countPipeline),
        this._em.aggregate(BinEntity, dataPipeline),
      ]);

      const total = totalResult.length > 0 ? totalResult[0].total : 0;

      return new PaginatedResult(
        rows,
        new PaginationMeta({
          total,
          page,
          limit,
        }),
      );
    } catch (error) {
      this._logger.error('Failed to find issuable items using aggregate:', error);
      throw error;
    }
  }

  public async findLoadcellItemsForIssue(params: ItemsForIssueInput): Promise<LoadcellEntity[]> {
    const { itemIds, binIds, expiryDate } = params;
    if (!itemIds || itemIds.length === 0) {
      return [];
    }

    const baseConditions = {
      item: { $in: itemIds.map((id) => new ObjectId(id)) },
      bin: { $in: binIds.map((id) => new ObjectId(id)) },
      state: { isCalibrated: true },
      availableQuantity: { $gt: 0 },
    };

    let where: FilterQuery<LoadcellEntity>;

    if (expiryDate) {
      where = {
        ...baseConditions,
        $or: [{ ['metadata.expiryDate' as any]: { $gte: new Date(expiryDate) } }, { ['metadata.expiryDate' as any]: null }],
      };
    } else {
      where = baseConditions;
    }

    const loadcells = await this._em.find(LoadcellEntity, where, {
      populate: ['item', 'item.itemType', 'bin', 'bin.loadcells', 'cabinet', 'cluster', 'site'],
    });

    if (loadcells.length === 0) {
      return [];
    }

    return loadcells.filter((l) => {
      const bin = RefHelper.get(l.bin);
      return bin && !bin.state.isDamaged && !bin.state.isFailed;
    });
  }

  public async findNormalItemsForIssue(params: ItemsForIssueInput): Promise<BinEntity[]> {
    const { itemIds, binIds, expiryDate } = params;
    if (!itemIds || itemIds.length === 0) {
      return [];
    }

    const baseConditions = {
      ['items.itemId']: { $in: itemIds.map((id) => new ObjectId(id)) },
      _id: { $in: binIds.map((id) => new ObjectId(id)) },
      state: { isDamaged: false, isFailed: false },
      ['items.qty']: { $gt: 0 },
    };

    let where: FilterQuery<BinEntity>;

    if (expiryDate) {
      where = {
        ...baseConditions,
        $or: [{ ['items.expiryDate' as any]: { $gte: new Date(expiryDate) } }, { ['items.expiryDate' as any]: null }],
      };
    } else {
      where = baseConditions;
    }

    return this._em.find(BinEntity, where, {
      populate: ['cabinet', 'cluster', 'site'],
    });
  }

  public async findUserIssueHistories(userId: string, itemIds: string[], binIds: string[]): Promise<IssueHistoryEntity[]> {
    return this._em.find(IssueHistoryEntity, {
      user: new ObjectId(userId),
      item: { $in: itemIds.map((id) => new ObjectId(id)) },
      locations: {
        binId: { $in: binIds.map((b) => new ObjectId(b)) },
      },
    });
  }

  public async getBinItems(params: Omit<ItemsForIssueInput, 'expiryDate'>): Promise<BinEntity[]> {
    return this._em.find(BinEntity, {
      _id: { $in: params.binIds.map((id) => new ObjectId(id)) },
      items: {
        itemId: { $in: params.itemIds.map((id) => new ObjectId(id)) },
      },
    });
  }

  public async findItems(itemIds: string[]): Promise<ItemEntity[]> {
    return this._em.find(ItemEntity, {
      _id: { $in: itemIds.map((i) => new ObjectId(i)) },
    });
  }

  public async findBinItems(binIds: string[]): Promise<ItemEntity[]> {
    const bins = await this._em.find(BinEntity, {
      _id: { $in: binIds.map((i) => new ObjectId(i)) },
    });
    const itemIds = bins.flatMap((bin) => {
      return bin.items.map((i) => i.itemId);
    });
    return this._em.find(ItemEntity, {
      _id: { $in: itemIds },
    });
  }
}
