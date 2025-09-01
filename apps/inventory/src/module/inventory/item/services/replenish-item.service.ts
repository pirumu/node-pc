import { AnotherItem, ExecutionStep, ItemToReplenish, PlannedItem } from '@common/business/types';
import { AuthUserDto, PaginatedResult } from '@common/dto';
import { LoadcellEntity, TransactionType } from '@dals/mongo/entities';
import { RefHelper } from '@dals/mongo/helpers';
import { AppHttpException } from '@framework/exception';
import { Injectable } from '@nestjs/common';

import { GetItemRequest, ItemRequest } from '../dtos/request';
import { ReplenishItemRepository } from '../repositories';
import { ReplenishableItemRecord } from '../repositories/item.types';

import { ItemProcessingService } from './item-processing.service';

@Injectable()
export class ReplenishItemService {
  constructor(
    private readonly _repository: ReplenishItemRepository,
    private readonly _itemProcessingService: ItemProcessingService,
  ) {}

  public async getReplenishableItems(query: GetItemRequest): Promise<PaginatedResult<ReplenishableItemRecord>> {
    const { page = 1, limit = 100, keyword, itemTypeId } = query;

    return this._repository.findReplenishableItems({
      page,
      limit,
      keyword,
      itemTypeId,
    });
  }

  public async replenish(user: AuthUserDto, dto: ItemRequest): Promise<{ transactionId: string; steps: ExecutionStep[] }> {
    const { items: replenishItems } = dto;

    if (!replenishItems || replenishItems.length === 0) {
      throw AppHttpException.badRequest({
        message: 'Replenish request must contain at least one item.',
      });
    }

    const { plan, totalReplenishQty } = await this._planReplenish(user, replenishItems);

    const steps = this._groupReplenishPlanByBin(plan);
    if (!steps || steps.length === 0) {
      throw AppHttpException.internalServerError({ message: 'Can not replenish items.' });
    }
    const transactionId = await this._itemProcessingService.createAndStartTransaction({
      userId: user.id,
      transactionType: TransactionType.REPLENISH,
      totalRequestQty: totalReplenishQty,
      executionSteps: steps,
    });

    return { transactionId, steps };
  }

  /**
   * Plan replenishment - similar structure to _planReturn
   */
  private async _planReplenish(user: AuthUserDto, replenishItems: ItemRequest['items']) {
    const itemIds = replenishItems.map((item) => item.itemId);

    // Get all loadcells that can accept replenishment
    const replenishableLoadcells = await this._repository.findItemsForReplenish(itemIds);
    // Create loadcell map for efficient lookup - same pattern as return
    const loadcellsByItemMap = new Map<string, LoadcellEntity[]>();
    for (const loadcell of replenishableLoadcells) {
      const item = RefHelper.getRequired(loadcell.item, 'ItemEntity');
      const itemId = item.id;
      if (!loadcellsByItemMap.has(itemId)) {
        loadcellsByItemMap.set(itemId, []);
      }
      loadcellsByItemMap.get(itemId)!.push(loadcell);
    }

    let plan: PlannedItem[] = [];
    let totalReplenishQty = 0;

    // Process each item - same loop structure as return
    for (const replenishItem of replenishItems) {
      const allocatedLoadcellIds = new Set<string>();

      let neededToReplenish = replenishItem.quantity;
      totalReplenishQty += neededToReplenish;

      const loadcellsForItem = loadcellsByItemMap.get(replenishItem.itemId);

      if (!loadcellsForItem || loadcellsForItem.length === 0) {
        throw AppHttpException.badRequest({
          message: `No loadcells found that can accept replenishment for item ${replenishItem.itemId}.`,
        });
      }

      // Sort loadcells by priority - the least stocked first (smart allocation)
      loadcellsForItem.sort((a, b) => {
        const stockLevelA = a.availableQuantity / a.calibration.calibratedQuantity;
        const stockLevelB = b.availableQuantity / b.calibration.calibratedQuantity;
        return stockLevelA - stockLevelB;
      });

      // Allocate to loadcells - same pattern as return allocation
      for (const loadcell of loadcellsForItem) {
        if (neededToReplenish <= 0) {
          break;
        }

        // Calculate available space
        const spaceAvailable = loadcell.calibration.calibratedQuantity - loadcell.availableQuantity;
        if (spaceAvailable <= 0) {
          continue; // This loadcell is full
        }
        allocatedLoadcellIds.add(loadcell.id);
        const qtyToReplenishHere = Math.min(neededToReplenish, spaceAvailable);
        // Create plan item
        const item = RefHelper.getRequired(loadcell.item, 'ItemEntity');
        const bin = RefHelper.getRequired(loadcell.bin, 'BinEntity');
        const cabinet = RefHelper.getRequired(loadcell.cabinet, 'CabinetEntity');
        const cluster = RefHelper.getRequired(loadcell.cluster, 'ClusterEntity');
        const site = RefHelper.getRequired(loadcell.site, 'SiteEntity');

        plan.push({
          name: item.name,
          itemId: replenishItem.itemId,
          requestQty: qtyToReplenishHere,
          currentQty: loadcell.availableQuantity,
          loadcellId: loadcell.id,
          loadcellLabel: loadcell.label,
          loadcellHardwareId: loadcell.hardwareId,
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
          keepTrackItems: bin.loadcells.map((l) => ({
            loadcellId: l.id,
            loadcellHardwareId: l.hardwareId,
            itemId: l.item?.id || '',
            name: l.item?.unwrap()?.name || '',
            binId: l.bin?.id || '',
            currentQty: l.availableQuantity,
            loadcellLabel: l.label,
          })),
        });

        neededToReplenish -= qtyToReplenishHere;
      }

      plan = plan.map((plan) => {
        plan.keepTrackItems = plan.keepTrackItems.filter((item) => !allocatedLoadcellIds.has(item.loadcellId));
        return plan;
      });

      // Validation - same pattern as return
      if (neededToReplenish > 0) {
        const totalAvailableSpace = loadcellsForItem.reduce(
          (sum, lc) => sum + (lc.calibration.calibratedQuantity - lc.availableQuantity),
          0,
        );

        throw AppHttpException.badRequest({
          message:
            `Cannot replenish full quantity for item ${replenishItem.itemId}. ` +
            `Requested: ${replenishItem.quantity}, Available space: ${totalAvailableSpace}.`,
        });
      }
    }

    return { plan, totalReplenishQty };
  }

  private _groupReplenishPlanByBin(plan: PlannedItem[]): ExecutionStep[] {
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

      const itemsToReplenish: ItemToReplenish[] = items.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        requestQty: item.requestQty,
        loadcellId: item.loadcellId,
        loadcellLabel: item.loadcellLabel,
        loadcellHardwareId: item.loadcellHardwareId,
        conditionId: item.conditionId,
        currentQty: item.currentQty,
      }));

      const trackingItemsMap = new Map<string, AnotherItem>();
      items.forEach((item) => {
        item.keepTrackItems.forEach((trackItem) => {
          trackingItemsMap.set(trackItem.loadcellId, trackItem);
        });
      });

      // Instructions for replenishment
      const instructions = [
        `Step ${stepIndex}: Go to cabinet ${location.cabinetName} and find bin ${location.binName}`,
        ...itemsToReplenish.map((item) => `Add ${item.requestQty} units of item ${item.name} from loadcell ${item.loadcellLabel}`),
        `Close ${location.binName}`,
      ];

      steps.push({
        stepId: `replenish_step_${stepIndex}_${binId}`,
        binId: binId,
        itemsToIssue: [],
        itemsToReturn: [],
        itemsToReplenish: itemsToReplenish,
        keepTrackItems: Array.from(trackingItemsMap.values()),
        instructions: instructions,
        location: location,
      });

      stepIndex++;
    }

    return steps;
  }
}
