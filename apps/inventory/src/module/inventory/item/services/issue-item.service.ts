import { AnotherItem, ExecutionStep, ItemToTake, PlannedItem } from '@common/business/types';
import { AuthUserDto, PaginatedResult } from '@common/dto';
import { TransactionType } from '@dals/mongo/entities';
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

    // Create detailed withdrawal plan
    // This determines exactly which bins to visit and how much to take from each
    const { plan, totalRequestQty } = await this._planWithdrawal(user, requestedItems, expiryDate);

    // Group the plan by bins to create simple execution steps
    // Each step represents one bin visit with clear instructions
    const steps = this._groupPlanByBin(plan);

    const transactionId = await this._itemProcessingService.createAndStartTransaction({
      userId: user.id,
      transactionType: TransactionType.ISSUE,
      totalRequestQty: totalRequestQty,
      executionSteps: steps,
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
  private async _planWithdrawal(user: AuthUserDto, requestedItems: ItemRequest['items'], expiryDate: number) {
    // Extract all item IDs from the request for batch queries
    const itemIds = requestedItems.map((item) => item.itemId);

    // Fetch data in parallel for performance:
    // 1. Available loadcells (sensors) containing requested items (not expired)
    // 2. User's historical bin usage for these items (for prioritization)
    const [availableLoadcells, userIssueHistories] = await Promise.all([
      this._repository.findItemsForIssue({ itemIds: itemIds, expiryDate }),
      this._repository.findUserIssueHistories(user.id, itemIds),
    ]);

    // Build a map of user's previous bin usage per item
    // Key: itemId, Value: array of bin IDs user has used for this item
    const userPreviousBinMap = new Map<string, string[]>();
    for (const history of userIssueHistories) {
      const binIds = history.locations.map((loc) => loc.binId.toHexString());
      userPreviousBinMap.set(history.item.id, binIds);
    }

    // Initialize plan array and total quantity counter
    const plan: PlannedItem[] = [];
    let totalRequestQty = 0;

    // Process each requested item individually
    for (const requestedItem of requestedItems) {
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

        // Add this allocation to the plan
        const item = RefHelper.getRequired(loadcell.item, 'ItemEntity');
        const bin = RefHelper.getRequired(loadcell.bin, 'BinEntity');
        const cabinet = RefHelper.getRequired(loadcell.cabinet, 'CabinetEntity');
        const cluster = RefHelper.getRequired(loadcell.cluster, 'ClusterEntity');
        const site = RefHelper.getRequired(loadcell.site, 'SiteEntity');

        plan.push({
          name: item.name,
          itemId: requestedItem.itemId,
          requestQty: qtyToTake,
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
          // IMPORTANT: Track all OTHER items in this bin for validation
          // This prevents users from taking unauthorized items from the same bin
          keepTrackItems: bin.loadcells
            .filter((l) => {
              return (
                // Include only valid loadcells
                !!l.bin?.id &&
                !!l.metadata?.itemId &&
                // EXCLUDE all requested items (they're authorized to be taken)
                !itemIds.includes(l.item?.id || '')
              );
            })
            .map((l) => {
              return {
                binId: l.bin!.id,
                itemId: l.item!.id,
                name: l.item?.unwrap()?.name || '',
                loadcellId: l.id,
                requestQty: 0,
                currentQty: l.availableQuantity,
              };
            }),
        });

        // Reduce the remaining necessary quantity
        neededQty -= qtyToTake;
      }

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
        name: item.name,
        requestQty: item.requestQty,
        currentQty: item.currentQty,
        loadcellId: item.loadcellId,
      }));

      // Merge and deduplicate tracking items from all items in this bin
      const trackingItemsMap = new Map<string, AnotherItem>();
      items.forEach((item) => {
        item.keepTrackItems.forEach((trackItem) => {
          trackingItemsMap.set(trackItem.loadcellId, trackItem);
        });
      });

      // Generate simple instructions
      const instructions = [
        `Step ${stepIndex}: Go to cabinet ${location.cabinetName} and bin ${location.binName}`,
        ...itemsToIssue.map((item) => `Take ${item.requestQty} units of ${item.name}`),
        `Close ${binId}`,
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
      });

      stepIndex++;
    }

    return steps;
  }
}
