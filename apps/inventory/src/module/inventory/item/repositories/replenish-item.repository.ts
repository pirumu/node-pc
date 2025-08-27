import { PaginatedResult, PaginationMeta } from '@common/dto';
import { LoadcellEntity } from '@dals/mongo/entities';
import { RefHelper } from '@dals/mongo/helpers';
import { AppHttpException } from '@framework/exception';
import { FilterQuery } from '@mikro-orm/core';
import { ObjectId, EntityManager } from '@mikro-orm/mongodb';
import { Injectable } from '@nestjs/common';

import { FindReplenishableItemsParams, ReplenishableItemRecord } from './item.types';

@Injectable()
export class ReplenishItemRepository {
  constructor(private readonly _em: EntityManager) {}

  public async findReplenishableItems(params: FindReplenishableItemsParams): Promise<PaginatedResult<ReplenishableItemRecord>> {
    const { page, limit, keyword, itemTypeId } = params;

    let itemConditions: Record<string, any> = {};

    if (keyword) {
      itemConditions = { $or: [{ name: { $ilike: `%${keyword}%` } }, { partNo: { $ilike: `%${keyword}%` } }] };
    }

    if (itemTypeId) {
      itemConditions = {
        ...itemConditions,
        itemType: {
          _id: new ObjectId(itemTypeId),
        },
      };
    }

    const where: FilterQuery<LoadcellEntity> = {
      item: {
        $ne: null,
        ...itemConditions,
      },
      state: { isCalibrated: true },
      bin: {
        $ne: null,
      },
      cluster: {
        $ne: null,
      },
      cabinet: {
        $ne: null,
      },
    };

    try {
      const [loadcells, total] = await this._em.findAndCount(LoadcellEntity, where, {
        populate: ['item', 'item.itemType', 'bin'],
        populateOrderBy: { bin: { x: 'ASC', y: 'ASC' } },
        limit: limit,
        offset: (page - 1) * limit,
      });

      const rows: ReplenishableItemRecord[] = loadcells.map((lc) => {
        const canReplenish = (lc: LoadcellEntity): boolean => {
          const bin = RefHelper.getRequired(lc.bin, 'BinEntity');
          return !bin.state.isFailed && !bin.state.isDamaged;
        };

        const cabinet = RefHelper.getRequired(lc.cabinet, 'CabinetEntity');
        const bin = RefHelper.getRequired(lc.bin, 'BinEntity');
        const item = RefHelper.getRequired(lc.item, 'ItemEntity');
        const itemType = RefHelper.getRequired(item.itemType, 'ItemTypeEntity');

        return {
          id: item.id,
          name: item.name,
          partNo: item.partNo,
          materialNo: item.materialNo,
          itemTypeId: item.itemType.id,
          type: itemType.name,
          image: item.itemImage,
          description: item.description,
          totalQuantity: lc.availableQuantity,
          totalCalcQuantity: lc.calibration.calibratedQuantity,
          binId: bin.id,
          binName: `${cabinet.name}-${cabinet.rowNumber}-${bin.x}-${bin.y}`,
          dueDate: lc.metadata?.expiryDate || null,
          canReplenish: canReplenish(lc),
        };
      });

      return new PaginatedResult(
        rows,
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
    const pipeline = [
      {
        $match: {
          ['item._id']: { $in: itemIds.map((id) => new ObjectId(id)) },
          ['state.calibration.isCalibrated']: true,
        },
      },
      {
        $match: {
          $expr: {
            $lt: ['$calibration.availableQuantity', '$calibration.calibratedQuantity'],
          },
        },
      },
      {
        $project: {
          _id: 1,
        },
      },
    ];

    const loadcells: ObjectId[] = await this._em.aggregate(LoadcellEntity, pipeline);

    const replenishableIds = loadcells.map((doc) => doc._id);

    if (replenishableIds.length === 0) {
      return [];
    }

    return this._em.find(
      LoadcellEntity,
      {
        _id: { $in: replenishableIds },
        bin: { state: { isFailed: false, isDamaged: false } },
      },
      {
        populate: ['item', 'bin', 'cabinet', 'cluster', 'site'],
      },
    );
  }
}
