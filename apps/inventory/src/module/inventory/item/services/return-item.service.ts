import { AnotherItem, ExecutionStep, PlannedItem, ItemToReturn } from '@common/business/types';
import { AuthUserDto, PaginatedResult } from '@common/dto';
import { IssuedItemLocation, IssueHistoryEntity, LoadcellEntity, TransactionType } from '@dals/mongo/entities';
import { RefHelper } from '@dals/mongo/helpers';
import { AppHttpException } from '@framework/exception';
import { EntityManager } from '@mikro-orm/core';
import { Injectable, Logger } from '@nestjs/common';

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

    const { plan, totalReturnQty } = await this._planReturn(user, returnItems);

    const steps = this._groupReturnPlanByBin(plan);

    const transactionId = await this._itemProcessingService.createAndStartTransaction({
      userId: user.id,
      transactionType: TransactionType.ISSUE,
      totalRequestQty: totalReturnQty,
      executionSteps: steps,
    });

    return { transactionId };
  }

  private async _planReturn(user: AuthUserDto, returnItems: ItemRequest['items']) {
    const itemIds = returnItems.map((item) => item.itemId);

    const userIssueHistories = await this._issueItemRepository.findUserIssueHistories(user.id, itemIds);

    const historyMap = new Map<string, IssueHistoryEntity>();
    for (const history of userIssueHistories) {
      historyMap.set(history.item.id, history);
    }

    const plan: PlannedItem[] = [];
    let totalReturnQty = 0;

    for (const returnItem of returnItems) {
      let neededToReturn = returnItem.quantity;
      totalReturnQty += neededToReturn;

      const history = historyMap.get(returnItem.itemId);

      if (!history) {
        throw AppHttpException.badRequest({
          message: `Item ${returnItem.itemId} has no issue history for user.`,
        });
      }

      const totalIssued = history.locations.reduce((sum: number, loc: IssuedItemLocation) => sum + loc.quantity, 0);

      if (neededToReturn > totalIssued) {
        throw AppHttpException.badRequest({
          message: `Cannot return ${neededToReturn} units of ${returnItem.itemId}. Only issued ${totalIssued} units.`,
        });
      }

      const loadcells = await this._em.find(LoadcellEntity, {
        _id: { $in: history.locations.map((l) => l.loadcellId) },
      });

      const loadcellsMap = new Map<string, LoadcellEntity>(loadcells.map((l) => [l.id, l]));

      for (const issuedLocation of history.locations) {
        if (neededToReturn <= 0) {
          break;
        }

        const qtyToReturnHere = Math.min(neededToReturn, issuedLocation.quantity);

        const loadcell = loadcellsMap.get(issuedLocation.loadcellId.toHexString());

        if (!loadcell) {
          this._logger.warn(`Loadcell ${issuedLocation.loadcellId} not found. Skipping.`);
          continue;
        }

        const item = RefHelper.getRequired(loadcell.item, 'ItemEntity');
        const bin = RefHelper.getRequired(loadcell.bin, 'BinItem');
        const cabinet = RefHelper.getRequired(loadcell.cabinet, 'CabinetEntity');
        const cluster = RefHelper.getRequired(loadcell.cluster, 'ClusterEntity');
        const site = RefHelper.getRequired(loadcell.site, 'SiteEntity');

        plan.push({
          name: item.name,
          itemId: returnItem.itemId,
          requestQty: qtyToReturnHere,
          currentQty: loadcell.availableQuantity,
          loadcellId: loadcell.id,
          location: {
            binId: bin.id,
            binName: `${bin.x}-${bin.y}`,
            cabinetId: cabinet.id,
            cabinetName: cabinet.name,
            clusterId: cabinet.id,
            clusterName: cluster.name,
            siteId: site.id,
            siteName: site.name,
          },
          keepTrackItems: bin.loadcells
            .filter((l) => !!l.bin?.id && !!l.item?.id && !itemIds.includes(l.item?.id))
            .map((l) => ({
              loadcellId: l.id,
              itemId: l.item!.id,
              name: l.item?.unwrap()?.name || '',
              currentQty: l.availableQuantity,
              binId: l.bin!.id,
            })),
        });

        neededToReturn -= qtyToReturnHere;
      }

      if (neededToReturn > 0) {
        throw AppHttpException.badRequest({
          message: `Could not allocate full return quantity for item ${returnItem.itemId}.`,
        });
      }
    }

    return { plan, totalReturnQty };
  }

  private _groupReturnPlanByBin(plan: PlannedItem[]): ExecutionStep[] {
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
      const location = items[0].location;

      const itemsToReturn: ItemToReturn[] = items.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        requestQty: item.requestQty,
        currentQty: item.currentQty,
        loadcellId: item.loadcellId,
        conditionId: item.conditionId,
      }));

      const trackingItemsMap = new Map<string, AnotherItem>();
      items.forEach((item) => {
        item.keepTrackItems.forEach((trackItem) => {
          trackingItemsMap.set(trackItem.loadcellId, trackItem);
        });
      });

      const instructions = [
        `Step ${stepIndex}: Go to cabinet ${location.cabinetName} and find bin ${location.binName}`,
        ...itemsToReturn.map((item) => `Return ${item.requestQty} units of ${item.name}`),
        `Close ${binId}`,
      ];

      steps.push({
        stepId: `return_step_${stepIndex}_${binId}`,
        binId: binId,
        itemsToIssue: [],
        itemsToReplenish: [],
        itemsToReturn: itemsToReturn,
        keepTrackItems: Array.from(trackingItemsMap.values()),
        instructions: instructions,
        location: location,
      });

      stepIndex++;
    }

    return steps;
  }
}
