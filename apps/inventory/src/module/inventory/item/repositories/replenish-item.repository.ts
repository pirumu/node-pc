import { PaginatedResult, PaginationMeta } from '@common/dto';
import { LoadcellEntity } from '@dals/mongo/entities';
import { ObjectId, EntityManager } from '@mikro-orm/mongodb';
import { Injectable } from '@nestjs/common';

import { FindReplenishableItemsParams, ReplenishableItemRecord } from './item.types';

@Injectable()
export class ReplenishItemRepository {
  constructor(private readonly _em: EntityManager) {}

  public async findReplenishableItems(params: FindReplenishableItemsParams): Promise<PaginatedResult<ReplenishableItemRecord>> {
    const { page, limit, keyword, itemTypeId } = params;

    const pipeline: any[] = [];

    const initialMatch: any = {
      ['state.isCalibrated']: true,
      itemId: { $ne: null },
      binId: { $ne: null },
      clusterId: { $ne: null },
      cabinetId: { $ne: null },
    };
    pipeline.push({ $match: initialMatch });

    pipeline.push({ $lookup: { from: 'items', localField: 'itemId', foreignField: '_id', as: 'item' } }, { $unwind: '$item' });
    pipeline.push(
      { $lookup: { from: 'item_types', localField: 'item.itemTypeId', foreignField: '_id', as: 'item.itemType' } },
      { $unwind: '$item.itemType' },
    );
    pipeline.push({ $lookup: { from: 'bins', localField: 'binId', foreignField: '_id', as: 'bin' } }, { $unwind: '$bin' });
    pipeline.push({ $lookup: { from: 'cabinets', localField: 'cabinetId', foreignField: '_id', as: 'cabinet' } }, { $unwind: '$cabinet' });

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
        item: { $first: '$item' },
        bin: { $first: '$bin' },
        cabinet: { $first: '$cabinet' },
        itemType: { $first: '$item.itemType' },

        locations: {
          $addToSet: {
            $concat: [
              '$cabinet.name',
              '-',
              { $toString: '$cabinet.rowNumber' },
              '-',
              { $toString: '$bin.x' },
              '-',
              { $toString: '$bin.y' },
            ],
          },
        },

        dueDates: { $push: '$metadata.expiryDate' },
        totalQuantity: { $sum: '$availableQuantity' },
        totalCalcQuantity: { $sum: '$calibration.calibratedQuantity' },
      },
    });

    pipeline.push({
      $project: {
        _id: 0,
        id: '$_id.itemId',
        binId: '$_id.binId',
        name: '$item.name',
        partNo: '$item.partNo',
        materialNo: '$item.materialNo',
        itemTypeId: '$itemType._id',
        type: '$itemType.name',
        image: '$item.itemImage',
        description: '$item.description',
        totalQuantity: 1,
        totalCalcQuantity: 1,

        locations: 1,

        binName: { $arrayElemAt: ['$locations', 0] },

        dueDate: { $min: '$dueDates' },
        canReplenish: {
          $and: [{ $not: '$bin.state.isFailed' }, { $not: '$bin.state.isDamaged' }],
        },
      },
    });

    const countPipeline = [...pipeline, { $count: 'total' }];

    try {
      const dataPipeline = [...pipeline, { $sort: { binName: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }];

      const [totalResult, rows] = await Promise.all([
        this._em.aggregate(LoadcellEntity, countPipeline),
        this._em.aggregate(LoadcellEntity, dataPipeline),
      ]);

      const total = totalResult.length > 0 ? totalResult[0].total : 0;

      return new PaginatedResult(
        rows as ReplenishableItemRecord[],
        new PaginationMeta({
          total,
          page,
          limit,
        }),
      );
    } catch (error) {
      throw error;
    }
  }

  public async findItemsForReplenish(itemIds: string[]): Promise<LoadcellEntity[]> {
    const itemObjectIds = itemIds.map((id) => new ObjectId(id));
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'bins',
          localField: 'binId',
          foreignField: '_id',
          as: 'binInfo',
        },
      },
      {
        $unwind: {
          path: '$binInfo',
          preserveNullAndEmptyArrays: false,
        },
      },

      {
        $match: {
          ['itemId']: { $in: itemObjectIds },
          ['state.isCalibrated']: true,
          ['binInfo.state.isFailed']: false,
          ['binInfo.state.isDamaged']: false,
        },
      },
      {
        $project: {
          _id: 1,
        },
      },
    ];

    try {
      const results = await this._em.aggregate(LoadcellEntity, pipeline);
      const replenishableIds = results.map((doc) => doc._id);
      if (replenishableIds.length === 0) {
        return [];
      }
      return this._em.find(
        LoadcellEntity,
        {
          _id: { $in: replenishableIds },
        },
        {
          populate: ['item', 'item.itemType', 'bin', 'bin.loadcells', 'cabinet', 'cluster', 'site'],
        },
      );
    } catch (error) {
      throw error;
    }
  }
}
