import { AnotherItem, ExecutionStep, PlannedItem, ItemToReturn, BinItemType } from '@common/business/types';
import { AuthUserDto, PaginatedResult } from '@common/dto';
import { BinEntity, IssueHistoryEntity, ItemEntity, LoadcellEntity, TransactionType } from '@dals/mongo/entities';
import { RefHelper } from '@dals/mongo/helpers';
import { AppHttpException } from '@framework/exception';
import { EntityManager } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { Injectable, Logger } from '@nestjs/common';
import { isMongoId } from 'class-validator';

import { GetItemRequest, ItemRequest } from '../dtos/request';
import { ReturnItemRepository, IssueItemRepository } from '../repositories';
import { ReturnableItemRecord } from '../repositories/item.types';

import { ItemProcessingService } from './item-processing.service';

@Injectable()
export class ReturnItemService {
  private readonly _logger = new Logger(ReturnItemService.name);

  constructor(
    private readonly _em: EntityManager,
    private readonly _issueItemRepository: IssueItemRepository,
    private readonly _returnItemRepository: ReturnItemRepository,
    private readonly _itemProcessingService: ItemProcessingService,
  ) {}

  public async getReturnableItems(userId: string, query: GetItemRequest): Promise<PaginatedResult<ReturnableItemRecord>> {
    const { page = 1, limit = 100, keyword, itemTypeId } = query;

    return this._returnItemRepository.findReturnableItems({
      userId,
      page,
      limit,
      keyword,
      itemTypeId,
    });
  }

  public async return(user: AuthUserDto, dto: ItemRequest): Promise<{ transactionId: string }> {
    const { items: returnItems } = dto;

    if (!returnItems || returnItems.length === 0) {
      throw AppHttpException.badRequest({ message: 'Return request must contain at least one item.' });
    }

    const { plan, totalReturnQty } = await this._planReturnItems(user, returnItems);
    const steps = this._groupReturnPlanByBin(plan);

    if (!steps || steps.length === 0) {
      throw AppHttpException.internalServerError({ message: 'Can not return items.' });
    }

    const transactionId = await this._itemProcessingService.createAndStartTransaction({
      userId: user.id,
      transactionType: TransactionType.RETURN,
      totalRequestQty: totalReturnQty,
      executionSteps: steps,
    });

    return { transactionId };
  }

  private async _planReturnItems(user: AuthUserDto, returnItems: ItemRequest['items']) {
    const itemIds = returnItems.map((item) => item.itemId);
    const binIds = returnItems.map((item) => item.binId);

    const userIssueHistories = await this._issueItemRepository.findUserIssueHistories(user.id, itemIds, binIds);

    const historyMap = new Map<string, IssueHistoryEntity>();
    for (const history of userIssueHistories) {
      historyMap.set(history.item.id, history);
    }

    const allLoadcellIds = userIssueHistories.flatMap((h) =>
      h.locations.map((l) => l.loadcellId).filter((id): id is ObjectId => id !== null),
    );
    const allBinIdsFromHistory = userIssueHistories.flatMap((h) => h.locations.map((l) => l.binId));

    const [loadcells, bins] = await Promise.all([
      allLoadcellIds.length > 0
        ? this._em.find(
            LoadcellEntity,
            { _id: { $in: allLoadcellIds } },
            { populate: ['item', 'bin', 'bin.loadcells.item', 'cabinet', 'cluster', 'site'] },
          )
        : Promise.resolve([]),
      allBinIdsFromHistory.length > 0
        ? this._em.find(BinEntity, { _id: { $in: allBinIdsFromHistory } }, { populate: ['items', 'cabinet', 'cluster', 'site'] })
        : Promise.resolve([]),
    ]);

    const allItemIdsFromBins = bins.flatMap((b) => b.items.map((i) => i.itemId));
    const itemsFromBins = await this._em.find(ItemEntity, { _id: { $in: allItemIdsFromBins } });

    const loadcellsMap = new Map<string, LoadcellEntity>(loadcells.map((l) => [l.id, l]));
    const binsMap = new Map<string, BinEntity>(bins.map((b) => [b.id, b]));
    const itemsMap = new Map<string, ItemEntity>(itemsFromBins.map((i) => [i.id, i]));

    let plan: PlannedItem[] = [];
    let totalReturnQty = 0;
    const allocatedLoadcellIds = new Set<string>();

    for (const returnItem of returnItems) {
      let neededToReturn = returnItem.quantity;
      totalReturnQty += neededToReturn;

      const history = historyMap.get(returnItem.itemId);
      if (!history) {
        throw AppHttpException.badRequest({ message: `Item ${returnItem.itemId} has no issue history for user.` });
      }

      const relevantLocations = history.locations.filter((loc) => loc.binId.toHexString() === returnItem.binId);

      const totalIssuedInBin = relevantLocations.reduce((sum, loc) => sum + loc.quantity, 0);
      if (neededToReturn > totalIssuedInBin) {
        throw AppHttpException.badRequest({
          message: `Cannot return ${neededToReturn} units of ${returnItem.itemId} to bin ${returnItem.binId}. Only ${totalIssuedInBin} units were issued from this location.`,
        });
      }

      for (const issuedLocation of relevantLocations) {
        if (neededToReturn <= 0) {
          break;
        }

        const qtyToReturnHere = Math.min(neededToReturn, issuedLocation.quantity);
        if (issuedLocation.loadcellId) {
          const loadcell = loadcellsMap.get(issuedLocation.loadcellId.toHexString());
          if (!loadcell) {
            throw AppHttpException.badRequest({
              message: `Could not allocate full return quantity for item ${returnItem.itemId}. Loadcell not found`,
            });
          }

          allocatedLoadcellIds.add(loadcell.id);

          const item = RefHelper.getRequired(loadcell.item, 'ItemEntity');
          const bin = RefHelper.getRequired(loadcell.bin, 'BinEntity');
          const cabinet = RefHelper.getRequired(loadcell.cabinet, 'CabinetEntity');
          const cluster = RefHelper.getRequired(loadcell.cluster, 'ClusterEntity');

          plan.push({
            name: item.name,
            itemId: returnItem.itemId,
            binId: bin.id,
            binItemType: BinItemType.LOADCELL,
            requestQty: qtyToReturnHere,
            currentQty: loadcell.availableQuantity,
            conditionId: returnItem.conditionId,
            loadcellId: loadcell.id,
            loadcellLabel: loadcell.label,
            loadcellHardwareId: loadcell.hardwareId,
            location: {
              binId: bin.id,
              binName: `${bin.index}-${bin.x}`,
              cabinetId: cabinet.id,
              cabinetName: cabinet.name,
              clusterId: cluster.id,
              clusterName: cluster.name,
              siteId: loadcell.site?.id || 'N/A',
              siteName: 'N/A',
            },
            keepTrackItems: bin.loadcells
              .filter((l) => !!l.item)
              .map((l) => ({
                loadcellId: l.id,
                binItemType: BinItemType.LOADCELL,
                loadcellHardwareId: l.hardwareId,
                itemId: l.item!.id,
                name: l.item!.unwrap().name,
                currentQty: l.availableQuantity,
                requestQty: 0,
                binId: bin.id,
                loadcellLabel: l.label,
              })),
            history: history.toPOJO(),
          });
          neededToReturn -= qtyToReturnHere;
        } else {
          const bin = binsMap.get(issuedLocation.binId.toHexString());
          if (!bin) {
            throw AppHttpException.badRequest({
              message: `Could not allocate full return quantity for item ${returnItem.itemId}. Bin not found`,
            });
          }
          const binItem = bin.items.find((i) => i.itemId.toHexString() === returnItem.itemId);
          if (!binItem) {
            throw AppHttpException.badRequest({
              message: `Could not allocate full return quantity for item ${returnItem.itemId}.Bin item not found`,
            });
          }

          const item = itemsMap.get(returnItem.itemId);
          if (!item) {
            throw AppHttpException.badRequest({ message: `Could not allocate full return quantity for item ${returnItem.itemId}.` });
          }

          const cabinet = RefHelper.getRequired(bin.cabinet, 'CabinetEntity');
          const cluster = RefHelper.getRequired(bin.cluster, 'ClusterEntity');

          plan.push({
            name: item.name,
            itemId: returnItem.itemId,
            binId: bin.id,
            binItemType: BinItemType.NORMAL,
            requestQty: qtyToReturnHere,
            currentQty: binItem.qty,
            conditionId: returnItem.conditionId,
            loadcellId: 'N/A',
            loadcellLabel: 'N/A',
            loadcellHardwareId: 0,
            location: {
              binId: bin.id,
              binName: `${bin.index}-${bin.x}`,
              cabinetId: cabinet.id,
              cabinetName: cabinet.name,
              clusterId: cluster.id,
              clusterName: cluster.name,
              siteId: bin.site?.id || 'N/A',
              siteName: 'N/A',
            },
            keepTrackItems: [],
            history: history.toPOJO(),
          });

          neededToReturn -= qtyToReturnHere;
        }
      }
      if (neededToReturn > 0) {
        throw AppHttpException.badRequest({ message: `Could not allocate full return quantity for item ${returnItem.itemId}.` });
      }
    }

    plan = plan.map((p) => {
      p.keepTrackItems = p.keepTrackItems.filter((item) => !allocatedLoadcellIds.has(item.loadcellId));
      return p;
    });

    return { plan, totalReturnQty };
  }

  private _groupReturnPlanByBin(plan: PlannedItem[]): ExecutionStep[] {
    try {
      const binGroups = new Map<string, PlannedItem[]>();

      for (const item of plan) {
        const binId = item.location.binId;

        if (!binGroups.has(binId)) {
          binGroups.set(binId, []);
        }

        binGroups.get(binId)!.push(item);
      }

      const steps: ExecutionStep[] = [];
      let stepIndex = 1;

      for (const [binId, items] of binGroups) {
        // now all item in same bin is grouped.
        const itemsToReturn: ItemToReturn[] = items.map((item) => ({
          itemId: item.itemId,
          binItemType: item.binItemType,
          binId: binId,
          name: item.name,
          requestQty: item.requestQty,
          currentQty: item.currentQty,
          loadcellId: item.loadcellId,
          loadcellHardwareId: item.loadcellHardwareId,
          loadcellLabel: item.loadcellLabel,
          conditionId: isMongoId(item.conditionId) ? item.conditionId : undefined,
          history: item.history,
        }));

        const trackingItemsMap = new Map<string, AnotherItem>();

        items.forEach((item) => {
          item.keepTrackItems.forEach((trackItem) => {
            if (trackItem.loadcellId !== 'N/A') {
              trackingItemsMap.set(trackItem.loadcellId, trackItem);
            }
          });
        });

        const instructions: any[] = [];

        steps.push({
          stepId: `return_step_${stepIndex}_${binId}`,
          binId: binId,
          itemsToIssue: [],
          itemsToReplenish: [],
          itemsToReturn: itemsToReturn,
          keepTrackItems: Array.from(trackingItemsMap.values()),
          instructions: instructions,
          location: items[0].location,
          issueHistories: itemsToReturn.map((i) => i.history),
        });

        stepIndex++;
      }

      return steps;
    } catch (err) {
      throw err;
    }
  }
}
