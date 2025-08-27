import { PaginatedResult, PaginationMeta } from '@common/dto';
import { IssueHistoryEntity, LoadcellEntity } from '@dals/mongo/entities';
import { EntityManager, FilterQuery } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { Injectable, Logger } from '@nestjs/common';

import { FindReturnableItemsParams, ReturnableItemRecord } from './item.types';
import { AppHttpException } from '@framework/exception';
import { RefHelper } from '@dals/mongo/helpers';

@Injectable()
export class ReturnItemRepository {
  private readonly _logger = new Logger(ReturnItemRepository.name);

  constructor(private readonly _em: EntityManager) {}

  public async findReturnableItems(params: FindReturnableItemsParams): Promise<PaginatedResult<ReturnableItemRecord>> {
    const { userId, page, limit, keyword, itemTypeId } = params;

    let itemConditions: Record<string, any> = {};

    if (keyword) {
      itemConditions = {
        $or: [{ name: { $ilike: `%${keyword}%` } }, { partNo: { $ilike: `%${keyword}%` } }],
      };
    }

    if (itemTypeId) {
      itemConditions = {
        ...itemConditions,
        itemType: {
          _id: new ObjectId(itemTypeId),
        },
      };
    }

    const where: FilterQuery<IssueHistoryEntity> = {
      item: {
        $ne: null,
        ...itemConditions,
      },
      user: {
        _id: new ObjectId(userId),
      },
    };

    try {
      const [histories, total] = await this._em.findAndCount(IssueHistoryEntity, where, {
        populate: ['item', 'item.itemType', 'user'],
        limit: limit,
        offset: (page - 1) * limit,
      });

      const loadcellIds = histories
        .flatMap((h) => h.locations.map((l) => l.loadcellId))
        .filter((id, index, arr) => arr.findIndex((otherId) => otherId.equals(id)) === index);

      const loadcells = await this._em.find(
        LoadcellEntity,
        { _id: { $in: loadcellIds } },
        { populate: ['bin', 'bin.loadcells', 'cabinet'] },
      );

      const loadcellsMap = new Map<string, LoadcellEntity>();

      loadcells.forEach((loadcell) => {
        if (loadcell.bin) {
          loadcellsMap.set(loadcell.id, loadcell);
        }
      });

      const rows: ReturnableItemRecord[] = histories.map((history) => {
        const locationNames: string[] = [];

        const itemInfo = history.locations
          .map((l) => {
            const loadcell = loadcellsMap.get(l.loadcellId.toHexString());
            if (!loadcell || !loadcell.bin || !loadcell.cabinet || !loadcell.item) {
              return null;
            }
            const bin = RefHelper.getRequired(loadcell.bin, 'BinEntity');
            const cabinet = RefHelper.getRequired(loadcell.cabinet, 'CabinetEntity');

            const location = `${cabinet.name}-${cabinet.rowNumber}-${bin.x}-${bin.y}`;
            locationNames.push(location);

            return {
              binId: l.binId.toHexString(),
              issuedQuantity: l.quantity,
              location: location,
              batchNumber: loadcell.metadata.batchNumber,
              serialNumber: loadcell.metadata.serialNumber,
              dueDate: loadcell.metadata.expiryDate,
            };
          })
          .filter((i) => i !== null);

        if (!history.item) {
          throw AppHttpException.internalServerError({ message: 'Error when enrich return items' });
        }
        const item = history.item.unwrap();
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
          issuedQuantity: history.totalIssuedQuantity,
          locations: locationNames,
          itemInfo: itemInfo,
          workingOrders: [],
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
      this._logger.error('Failed to find returnable items:', error);
      throw error;
    }
  }
}
