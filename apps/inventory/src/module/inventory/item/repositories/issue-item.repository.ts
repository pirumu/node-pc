import { PaginatedResult, PaginationMeta } from '@common/dto';
import { IssueHistoryEntity, LoadcellEntity } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { EntityManager, FilterQuery, QueryOrder } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { Injectable, Logger } from '@nestjs/common';

import { FindIssuableItemsParams, IssuableItemRecord, ItemsForIssueInput } from './item.types';

@Injectable()
export class IssueItemRepository {
  private readonly _logger = new Logger(IssueItemRepository.name);

  constructor(private readonly _em: EntityManager) {}

  public async findIssuableItems(params: FindIssuableItemsParams): Promise<PaginatedResult<IssuableItemRecord>> {
    const { page, limit, keyword, itemTypeId, expiryDate } = params;

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
        ...itemConditions,
      },
      state: { isCalibrated: true },
    };

    try {
      const [loadcells, total] = await this._em.findAndCount(LoadcellEntity, where, {
        populateOrderBy: { bin: { x: QueryOrder.ASC, y: QueryOrder.ASC } },
        limit: limit,
        offset: (page - 1) * limit,
        populate: ['item', 'item.itemType', 'bin'],
      });

      const rows: IssuableItemRecord[] = loadcells.map((lc) => {
        const canIssue = (lc: LoadcellEntity): boolean => {
          if (lc.availableQuantity <= 0) {
            return false;
          }
          if ((lc.metadata?.expiryDate !== null || true) && (lc.metadata?.expiryDate?.getTime() || 0) >= expiryDate) {
            return true;
          }
          const bin = lc.bin?.unwrap();
          if (!bin) {
            return false;
          }
          return !bin.state.isFailed && !bin.state.isDamaged;
        };

        if (!lc.item || !lc.bin || !lc.cabinet) {
          throw AppHttpException.internalServerError({ message: 'error when handle issuable items' });
        }
        const cabinet = lc.cabinet.unwrap();
        const bin = lc.bin.unwrap();
        const item = lc.item.unwrap();
        const itemType = item.itemType.unwrap();

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
          binId: lc.bin.id,
          binName: `${cabinet.name}-${cabinet.rowNumber}-${bin.x}-${bin.y}`,
          dueDate: lc.metadata?.expiryDate || null,
          canIssue: canIssue(lc),
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
      this._logger.error('Failed to find issuable items:', error);
      throw error;
    }
  }

  public async findItemsForIssue(params: ItemsForIssueInput): Promise<LoadcellEntity[]> {
    const { itemIds, expiryDate } = params;
    if (!itemIds || itemIds.length === 0) {
      return [];
    }

    let timeConditions: Record<string, any> = {};

    if (expiryDate) {
      timeConditions = { $or: [{ expiryDate: { $gte: new Date(expiryDate) } }, { expiryDate: null }] };
    }
    const where: FilterQuery<LoadcellEntity> = {
      item: {
        _id: { $in: itemIds.map((id) => new ObjectId(id)) },
      },
      metadata: {
        ...timeConditions,
      },
      state: { isCalibrated: true },
      availableQuantity: { $gt: 0 },
      bin: {
        state: {
          isFailed: false,
          isDamaged: false,
        },
      },
    };

    const loadcells = await this._em.find(LoadcellEntity, where, {
      populate: ['item', 'item.itemType', 'bin', 'bin.loadcells', 'cabinet', 'cluster', 'site'],
    });

    if (loadcells.length === 0) {
      return [];
    }
    return loadcells;
  }

  public async findUserIssueHistories(userId: string, itemIds: string[]): Promise<IssueHistoryEntity[]> {
    return this._em.find(IssueHistoryEntity, {
      user: new ObjectId(userId),
      item: { $in: itemIds.map((id) => new ObjectId(id)) },
    });
  }
}
