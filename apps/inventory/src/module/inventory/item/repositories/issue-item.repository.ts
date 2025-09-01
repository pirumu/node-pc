import { PaginatedResult, PaginationMeta } from '@common/dto';
import { IssueHistoryEntity, LoadcellEntity } from '@dals/mongo/entities';
import { RefHelper } from '@dals/mongo/helpers';
import { EntityManager, FilterQuery, ObjectId } from '@mikro-orm/mongodb';
import { Injectable, Logger } from '@nestjs/common';

import { FindIssuableItemsParams, IssuableItemRecord, ItemsForIssueInput } from './item.types';

@Injectable()
export class IssueItemRepository {
  private readonly _logger = new Logger(IssueItemRepository.name);

  constructor(private readonly _em: EntityManager) {}

  public async findIssuableItems(params: FindIssuableItemsParams): Promise<PaginatedResult<IssuableItemRecord>> {
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
          $concat: ['$cabinet.name', '-', { $toString: '$bin.x' }, '-', { $toString: '$bin.y' }],
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

    // Group theo bin + item và sum quantities từ tất cả loadcells
    pipeline.push({
      $group: {
        _id: {
          itemId: '$item._id',
          binId: '$bin._id',
        },
        // Sum quantities từ tất cả loadcells trong cùng bin + item
        totalQuantity: { $sum: '$availableQuantity' },
        totalCalcQuantity: { $sum: '$calibration.calibratedQuantity' },
        // Lấy thông tin khác từ document đầu tiên (vì giống nhau)
        item: { $first: '$item' },
        bin: { $first: '$bin' },
        cabinet: { $first: '$cabinet' },
        binName: { $first: '$binName' },
        dueDate: { $first: '$metadata.expiryDate' },
        // Logic canIssue: nếu có ít nhất 1 loadcell có thể issue
        canIssue: { $max: '$canIssue' },
        // Count số loadcells
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
        totalQuantity: '$totalQuantity', // Tổng quantity từ tất cả loadcells trong bin
        totalCalcQuantity: '$totalCalcQuantity', // Tổng calibrated quantity
        binName: '$binName',
        dueDate: '$dueDate',
        canIssue: '$canIssue',
        loadcellCount: '$loadcellCount', // Số lượng loadcells trong bin này
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
  public async findItemsForIssue(params: ItemsForIssueInput): Promise<LoadcellEntity[]> {
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
        // $or: [{ ['metadata.expiryDate' as any]: { $gte: new Date(expiryDate) } }, { ['metadata.expiryDate' as any]: null }],
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

  public async findUserIssueHistories(userId: string, itemIds: string[]): Promise<IssueHistoryEntity[]> {
    return this._em.find(IssueHistoryEntity, {
      user: new ObjectId(userId),
      item: { $in: itemIds.map((id) => new ObjectId(id)) },
    });
  }
}
