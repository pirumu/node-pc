import { AnotherItem, BinItemType, ExecutionStep, ItemToTake, PlannedItem } from '@common/business/types';
import { AuthUserDto, PaginatedResult } from '@common/dto';
import { ItemEntity, TransactionType } from '@dals/mongo/entities';
import { RefHelper } from '@dals/mongo/helpers';
import { AppHttpException } from '@framework/exception';
import { Injectable } from '@nestjs/common';

import { GetItemRequest, ItemRequest } from '../dtos/request';
import { IssueItemRepository } from '../repositories';
import { IssuableItemRecord } from '../repositories/item.types';

import { ItemProcessingService } from './item-processing.service';

@Injectable()
export class IssueItemService {
  constructor(
    private readonly _repository: IssueItemRepository,
    private readonly _itemProcessingService: ItemProcessingService,
  ) {}

  public async getIssuableItems(query: GetItemRequest): Promise<PaginatedResult<IssuableItemRecord>> {
    const { page = 1, limit = 100, keyword, itemTypeId } = query;

    const expiryDate = new Date().setHours(0, 0, 0, 0);

    return this._repository.findIssuableItems({
      page,
      limit,
      keyword,
      itemTypeId,
      expiryDate,
    });
  }

  public async issue(user: AuthUserDto, dto: ItemRequest): Promise<{ transactionId: string }> {
    // Extract requested items from the DTO
    const { items: requestedItems } = dto;

    // Set expiry date filter to start of today (midnight)
    // This ensures we only consider items that haven't expired yet
    const expiryDate = new Date().setHours(0, 0, 0, 0);

    // Validate request contains at least one item
    if (!requestedItems || requestedItems.length === 0) {
      throw AppHttpException.badRequest({ message: 'Request must contain at least one item.' });
    }

    const binItems = await this._repository.getBinItems({
      binIds: requestedItems.map((i) => i.binId),
      itemIds: requestedItems.map((i) => i.itemId),
    });

    const requestedLoadcellItems: ItemRequest['items'] = [];
    const requestedBinItems: ItemRequest['items'] = [];

    for (const item of requestedItems) {
      const binItem = binItems.find((b) => b.id === item.binId);
      if (!binItem) {
        requestedLoadcellItems.push(item);
      } else {
        requestedBinItems.push(item);
      }
    }
    // Create detailed withdrawal plan
    // This determines exactly which bins to visit and how much to take from each
    const [
      { plan: issueLoadcellItemPlan, totalRequestQty: totalRequestLoadcellItemQty },
      { plan: issueBinItemPlan, totalRequestQty: totalRequestBinItemQty },
    ] = await Promise.all([
      this._planWithdrawalForLoadcellItem(user, requestedLoadcellItems, expiryDate),
      this._planWithdrawalForNormalItem(user, requestedBinItems, expiryDate),
    ]);

    // Group the plan by bins to create simple execution steps
    // Each step represents one bin visit with clear instructions
    const steps = this._groupPlanByBin([...issueLoadcellItemPlan, ...issueBinItemPlan]);
    if (!steps || steps.length === 0) {
      throw AppHttpException.internalServerError({ message: 'Can not issue items.' });
    }
    const transactionId = await this._itemProcessingService.createAndStartTransaction({
      userId: user.id,
      transactionType: TransactionType.ISSUE,
      totalRequestQty: totalRequestLoadcellItemQty + totalRequestBinItemQty,
      executionSteps: steps,
      workingOrders: requestedItems.map((i) => i.workingOrders || []).flat(),
    });

    return { transactionId };
  }

  /**
   * Creates a detailed withdrawal plan for user requests
   *
   * Purpose:
   * - Determines how many items to take from which bins
   * - Prioritizes bins that user has previously used (for familiarity)
   * - Tracks all other items in bins for validation against unauthorized taking
   * - Supports cross-bin allocation: one item type can be taken from multiple bins
   */
  private async _planWithdrawalForLoadcellItem(
    user: AuthUserDto,
    requestedItems: ItemRequest['items'],
    expiryDate: number,
  ): Promise<{ plan: PlannedItem[]; totalRequestQty: number }> {
    if (requestedItems.length === 0) {
      return { plan: [], totalRequestQty: 0 };
    }
    // Extract all item IDs from the request for batch queries
    const itemIds = requestedItems.map((item) => item.itemId);
    const binIds = requestedItems.map((item) => item.binId);

    // Fetch data in parallel for performance:
    // 1. Available loadcells (sensors) containing requested items (not expired)
    // 2. User's historical bin usage for these items (for prioritization)
    const [availableLoadcells, userIssueHistories] = await Promise.all([
      this._repository.findLoadcellItemsForIssue({ itemIds: itemIds, binIds: binIds, expiryDate }),
      this._repository.findUserIssueHistories(user.id, itemIds, binIds),
    ]);

    // Build a map of user's previous bin usage per item
    // Key: itemId, Value: array of bin IDs user has used for this item
    const userPreviousBinMap = new Map<string, string[]>();
    for (const history of userIssueHistories) {
      const binIds = history.locations.map((loc) => loc.binId.toHexString());
      userPreviousBinMap.set(history.item.id, binIds);
    }

    // Initialize plan array and total quantity counter
    let plan: PlannedItem[] = [];
    let totalRequestQty = 0;

    // Process each requested item individually
    for (const requestedItem of requestedItems) {
      const allocatedLoadcellIds = new Set<string>();

      let neededQty = requestedItem.quantity;
      totalRequestQty += neededQty;

      // Find all loadcells that contain this specific item
      const loadcellsForItem = availableLoadcells.filter((lc) => lc.item!.id === requestedItem.itemId);

      // Validate item availability
      if (loadcellsForItem.length === 0) {
        throw AppHttpException.badRequest({
          message: `Item ${requestedItem.itemId} is not available in any active bin.`,
        });
      }

      // Get bins user has previously used for this item (for prioritization)
      const previousBins = userPreviousBinMap.get(requestedItem.itemId) || [];

      // Sort loadcells to prioritize bins user has used before
      // This improves user experience by reducing the need to learn new bin locations
      loadcellsForItem.sort((current, next) => {
        const isCurrentInPrevious = previousBins.includes(current.bin!.id);
        const isNextInPrevious = previousBins.includes(next.bin!.id);

        // If current bin was used before but next wasn't, prioritize current
        if (isCurrentInPrevious && !isNextInPrevious) {
          return -1; // current comes first
        }
        // If next bin was used before but the current wasn't, prioritize next
        if (!isCurrentInPrevious && isNextInPrevious) {
          return 1; // next comes first
        }
        // Both or neither were used before, maintain original order
        return 0;
      });

      // Allocate quantities from available loadcells (in priority order)
      for (const loadcell of loadcellsForItem) {
        // Stop if we've satisfied the necessary quantity
        if (neededQty <= 0) {
          break;
        }

        const availableQty = loadcell.availableQuantity;
        // Take the minimum of what's needed vs. what's available
        const qtyToTake = Math.min(neededQty, availableQty);

        allocatedLoadcellIds.add(loadcell.id);

        // Add this allocation to the plan
        const item = RefHelper.getRequired(loadcell.item, 'ItemEntity');
        const bin = RefHelper.getRequired(loadcell.bin, 'BinEntity');
        const cabinet = RefHelper.getRequired(loadcell.cabinet, 'CabinetEntity');
        const cluster = RefHelper.getRequired(loadcell.cluster, 'ClusterEntity');
        const site = RefHelper.getRequired(loadcell.site, 'SiteEntity');

        plan.push({
          name: item.name,
          binId: bin.id,
          binItemType: BinItemType.LOADCELL,
          itemId: requestedItem.itemId,
          requestQty: qtyToTake,
          currentQty: loadcell.availableQuantity,
          loadcellId: loadcell.id,
          loadcellHardwareId: loadcell.hardwareId,
          loadcellLabel: loadcell.label,
          location: {
            binId: bin.id,
            binName: `${bin.index}-${bin.x}`,
            cabinetId: cabinet.id,
            cabinetName: cabinet.name,
            clusterId: cabinet.id,
            clusterName: cluster.name,
            siteId: site.id,
            siteName: site.name,
          },
          keepTrackItems: bin.loadcells.map((l) => {
            return {
              binItemType: BinItemType.LOADCELL,
              binId: l.bin!.id,
              itemId: l.item!.id,
              name: l.item?.unwrap()?.name || '',
              loadcellId: l.id,
              requestQty: 0,
              currentQty: l.availableQuantity,
              loadcellHardwareId: l.hardwareId,
              loadcellLabel: l.label,
            };
          }),
          history: null,
        });

        // Reduce the remaining necessary quantity
        neededQty -= qtyToTake;
      }

      plan = plan.map((plan) => {
        plan.keepTrackItems = plan.keepTrackItems.filter((item) => !allocatedLoadcellIds.has(item.loadcellId));
        return plan;
      });

      // Validate that we can fulfill the complete request
      if (neededQty > 0) {
        const availableTotal = loadcellsForItem.reduce((sum, lc) => sum + lc.availableQuantity, 0);
        throw AppHttpException.badRequest({
          message: `Not enough stock for item ${requestedItem.itemId}. Requested: ${requestedItem.quantity}, Available: ${availableTotal}.`,
        });
      }
    }

    return { plan, totalRequestQty };
  }

  private async _planWithdrawalForNormalItem(
    user: AuthUserDto,
    requestedItems: ItemRequest['items'],
    expiryDate: number,
  ): Promise<{ plan: PlannedItem[]; totalRequestQty: number }> {
    if (requestedItems.length === 0) {
      return { plan: [], totalRequestQty: 0 };
    }
    // Extract all item IDs from the request for batch queries
    const binIds = requestedItems.map((item) => item.binId);
    const itemIds = requestedItems.map((item) => item.itemId);

    // Fetch data in parallel for performance:
    // 1. Available bins containing requested items (not expired)
    // 2. User's historical bin usage for these items (for prioritization)
    const [availableBins, userIssueHistories, items, binItems] = await Promise.all([
      this._repository.findNormalItemsForIssue({ itemIds: itemIds, binIds: binIds, expiryDate }),
      this._repository.findUserIssueHistories(user.id, itemIds, binIds),
      this._repository.findItems(itemIds),
      this._repository.findBinItems(binIds),
    ]);

    const itemsMap = new Map<string, ItemEntity>(items.map((item) => [item.id, item]));
    for (const item of binItems) {
      itemsMap.set(item.id, item);
    }

    // Build a map of user's previous bin usage per item
    // Key: itemId, Value: array of bin IDs user has used for this item
    const userPreviousBinMap = new Map<string, string[]>();
    for (const history of userIssueHistories) {
      const binIds = history.locations.map((loc) => loc.binId.toHexString());
      userPreviousBinMap.set(history.item.id, binIds);
    }

    // Initialize plan array and total quantity counter
    let plan: PlannedItem[] = [];
    let totalRequestQty = 0;

    // Process each requested item individually
    for (const requestedItem of requestedItems) {
      const allocatedBinItemIds = new Set<string>();

      let neededQty = requestedItem.quantity;
      totalRequestQty += neededQty;

      // Find all bins that contain this specific item in their items array
      const binsWithItem = availableBins.filter((bin) =>
        bin.items.some((binItem) => binItem.itemId.toHexString() === requestedItem.itemId),
      );

      // Validate item availability
      if (binsWithItem.length === 0) {
        throw AppHttpException.badRequest({
          message: `Item ${requestedItem.itemId} is not available in any active bin.`,
        });
      }

      // Get bins user has previously used for this item (for prioritization)
      const previousBins = userPreviousBinMap.get(requestedItem.itemId) || [];

      // Sort bins to prioritize bins user has used before
      // This improves user experience by reducing the need to learn new bin locations
      binsWithItem.sort((current, next) => {
        const isCurrentInPrevious = previousBins.includes(current.id);
        const isNextInPrevious = previousBins.includes(next.id);

        // If current bin was used before but next wasn't, prioritize current
        if (isCurrentInPrevious && !isNextInPrevious) {
          return -1; // current comes first
        }
        // If next bin was used before but the current wasn't, prioritize next
        if (!isCurrentInPrevious && isNextInPrevious) {
          return 1; // next comes first
        }
        // Both or neither were used before, maintain original order
        return 0;
      });

      // Allocate quantities from available bins (in priority order)
      for (const bin of binsWithItem) {
        // Stop if we've satisfied the necessary quantity
        if (neededQty <= 0) {
          break;
        }

        // Find the specific item in this bin
        const binItem = bin.items.find((item) => item.itemId.toHexString() === requestedItem.itemId);

        if (!binItem) {
          continue;
        }

        const availableQty = binItem.qty;
        // Take the minimum of what's needed vs. what's available
        const qtyToTake = Math.min(neededQty, availableQty);

        const binItemId = `${bin.id}-${binItem.itemId.toHexString()}`;
        allocatedBinItemIds.add(binItemId);

        // Get related entities
        const cabinet = RefHelper.getRequired(bin.cabinet, 'CabinetEntity');
        const cluster = RefHelper.getRequired(bin.cluster, 'ClusterEntity');
        const site = RefHelper.getRequired(bin.site, 'SiteEntity');
        const item = itemsMap.get(requestedItem.itemId);
        if (!item) {
          throw AppHttpException.badRequest({ message: `Item ${requestedItem.itemId} is not found.` });
        }
        // Add this allocation to the plan (keeping original structure)
        plan.push({
          name: item.name,
          binId: bin.id,
          binItemType: BinItemType.NORMAL,
          itemId: item.id,
          requestQty: qtyToTake,
          currentQty: binItem.qty,
          loadcellId: 'N/A',
          loadcellHardwareId: 0,
          loadcellLabel: 'N/A',
          location: {
            binId: bin.id,
            binName: `${bin.index}-${bin.x}`,
            cabinetId: cabinet.id,
            cabinetName: cabinet.name,
            clusterId: cluster.id,
            clusterName: cluster.name,
            siteId: site.id,
            siteName: site.name,
          },
          history: null,
          keepTrackItems: bin.items.map((item) => {
            return {
              name: itemsMap.get(item.itemId.toHexString())?.name || 'N/A',
              binItemType: BinItemType.NORMAL,
              binId: bin.id,
              itemId: item.itemId.toHexString(),
              loadcellId: 'N/A',
              requestQty: 0,
              currentQty: item.qty,
              loadcellHardwareId: 0,
              loadcellLabel: 'N/A',
            };
          }),
        });

        neededQty -= qtyToTake;
      }

      plan = plan.map((planItem) => {
        planItem.keepTrackItems = planItem.keepTrackItems.filter((item) => !allocatedBinItemIds.has(`${item.binId}-${item.itemId}`));
        return planItem;
      });

      // Validate that we can fulfill the complete request
      if (neededQty > 0) {
        const availableTotal = binsWithItem.reduce((sum, bin) => {
          const binItem = bin.items.find((item) => item.itemId.toHexString() === requestedItem.itemId);
          return sum + (binItem ? binItem.qty : 0);
        }, 0);

        throw AppHttpException.badRequest({
          message: `Not enough stock for item ${requestedItem.itemId}. Requested: ${requestedItem.quantity}, Available: ${availableTotal}.`,
        });
      }
    }

    return { plan, totalRequestQty };
  }

  /**
   * Each step represents one bin visit with all items to take from that bin
   *
   * Purpose:
   * - Each step = one bin visit
   * - Clearly defines what items to take from each bin
   * - Provides tracking items for validation
   * - Simple and straightforward approach
   */
  private _groupPlanByBin(plan: PlannedItem[]): ExecutionStep[] {
    // Group planned items by bin ID
    const binGroups = new Map<string, PlannedItem[]>();

    for (const item of plan) {
      const binId = item.location.binId;

      if (!binGroups.has(binId)) {
        binGroups.set(binId, []);
      }

      binGroups.get(binId)!.push(item);
    }

    // Create one step per bin
    const steps: ExecutionStep[] = [];
    let stepIndex = 1;

    for (const [binId, items] of binGroups) {
      // now all item in same bin is grouped.
      const location = items[0].location;
      // Prepare items to take from this bin
      const itemsToIssue: ItemToTake[] = items.map((item) => ({
        itemId: item.itemId,
        binId: item.binId,
        binItemType: item.binItemType,
        name: item.name,
        requestQty: item.requestQty,
        currentQty: item.currentQty,
        loadcellId: item.loadcellId,
        loadcellLabel: item.loadcellLabel,
        loadcellHardwareId: item.loadcellHardwareId,
        history: item.history,
      }));

      // Merge and deduplicate tracking items from all items in this bin
      const trackingItemsMap = new Map<string, AnotherItem>();
      items.forEach((item) => {
        item.keepTrackItems.forEach((trackItem) => {
          if (trackItem.binItemType === BinItemType.NORMAL) {
            trackingItemsMap.set(`${trackItem.itemId}-${trackItem.binId}`, trackItem);
          } else {
            trackingItemsMap.set(trackItem.loadcellId, trackItem);
          }
        });
      });

      // Generate simple instructions
      const instructions = [
        `Start: go to cabinet ${location.cabinetName} and find bin ${location.binName}`,
        ...itemsToIssue.map((item) => {
          if (item.binItemType === BinItemType.NORMAL) {
            return `Take ${item.requestQty} units of item ${item.name}`;
          }
          return `Take ${item.requestQty} units of item ${item.name} from loadcell ${item.loadcellLabel}`;
        }),
        `End: close bin ${location.binName}`,
      ];

      // Create the step
      steps.push({
        stepId: `issue_step_${stepIndex}_${binId}`,
        binId: binId,
        itemsToIssue: itemsToIssue,
        itemsToReturn: [],
        itemsToReplenish: [],
        keepTrackItems: Array.from(trackingItemsMap.values()),
        instructions: instructions,
        location: items[0].location,
        issueHistories: null,
      });

      stepIndex++;
    }

    return steps;
  }
}
