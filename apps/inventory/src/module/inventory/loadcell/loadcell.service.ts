import { PaginatedResult, PaginationMeta } from '@common/dto';
import { LoadcellEntity, ItemEntity, BinEntity, LoadcellItem } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { PublisherService } from '@framework/publisher';
import { EntityRepository, FindOptions, ObjectId, Transactional } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, Logger } from '@nestjs/common';
import { FilterQuery } from 'mongoose';

import { CalibrateLoadcellRequest, GetLoadCellsRequest } from './dtos/request';
// import { DeviceActivatedEvent } from './events';

@Injectable()
export class LoadcellService {
  private readonly _logger = new Logger(LoadcellService.name);

  constructor(
    private readonly _publisherService: PublisherService,
    @InjectRepository(ItemEntity) private readonly _itemRepository: EntityRepository<ItemEntity>,
    @InjectRepository(BinEntity) private readonly _binRepository: EntityRepository<BinEntity>,
    @InjectRepository(LoadcellEntity) private readonly _loadcellRepository: EntityRepository<LoadcellEntity>,
  ) {}

  public async getLoadCells(query: GetLoadCellsRequest): Promise<PaginatedResult<LoadcellEntity>> {
    const { portId, page, limit } = query;
    const where: FilterQuery<LoadcellEntity> = {};

    if (portId) {
      where.port._id = new ObjectId(portId);
    }

    const options: FindOptions<LoadcellEntity, keyof LoadcellEntity> = {
      limit: limit,
      offset: (page - 1) * limit,
    };
    const [rows, count] = await this._loadcellRepository.findAndCount(where, options);

    return new PaginatedResult(
      rows,
      new PaginationMeta({
        limit,
        page,
        total: count,
      }),
    );
  }

  @Transactional()
  public async unassign(loadcellId: string): Promise<boolean> {
    const loadcell = await this._loadcellRepository.findOne(new ObjectId(loadcellId), { populate: ['bin'] });
    if (!loadcell) {
      throw AppHttpException.badRequest({ message: `loadcell ${loadcellId} not found` });
    }

    const binId = loadcell.bin?._id;

    loadcell.unassign();

    await this._loadcellRepository.getEntityManager().persistAndFlush(loadcell);

    if (binId) {
      const bin = await this._binRepository.findOne(binId);
      if (bin) {
        bin.removeLoadcell(loadcell._id);
        await this._binRepository.getEntityManager().persistAndFlush(bin);
      }
    }
    return true;
  }

  public async activate(id: string): Promise<boolean> {
    const loadcell = await this._loadcellRepository.findOne(new ObjectId(id));
    if (!loadcell) {
      throw AppHttpException.badRequest({ message: `Loadcell ${id} not found` });
    }
    // await this._publisherService.publish(
    //   Transport.MQTT,
    //   '',
    //   new DeviceActivatedEvent({
    //     deviceId: loadcell.id,
    //     deviceNumId: loadcell.hardwareId,
    //   }),
    // );
    return true;
  }

  /**
   * Calibrates a loadcell for a specific item, ensuring data integrity within a cluster.
   * This process requires the item's data block to already exist on a loadcell within
   * the operational cluster. It can then be moved or swapped to the target loadcell
   * before calibration. The service does not create new item data blocks.
   */
  @Transactional()
  public async calibrate(loadcellId: string, calibrateData: CalibrateLoadcellRequest): Promise<boolean> {
    const { itemId } = calibrateData;

    //  Step 1: Initial Data Fetching and Validation
    // Fetch all required entities. We must populate 'cluster' to determine the operational scope.
    const [targetLoadcell, itemToCalibrate] = await Promise.all([
      this._loadcellRepository.findOne(new ObjectId(loadcellId), { populate: ['bin', 'cluster'] }),
      this._itemRepository.findOne(new ObjectId(itemId)),
    ]);

    // Perform critical initial validations.
    if (!targetLoadcell) {
      throw AppHttpException.badRequest({ message: `Loadcell ${loadcellId} not found` });
    }
    if (!targetLoadcell.bin) {
      throw AppHttpException.badRequest({ message: `Loadcell ${loadcellId} must be linked to a bin before calibration` });
    }
    if (!targetLoadcell.cluster) {
      throw AppHttpException.internalServerError({
        message: `Configuration Error: Loadcell ${targetLoadcell.id} is not associated with any cluster.`,
      });
    }
    if (!itemToCalibrate) {
      throw AppHttpException.badRequest({ message: `Item ${itemId} not found` });
    }

    // Step 2: Define Operational Scope and Fetch Sibling Loadcells
    // The scope is all loadcells within the same cluster as the target loadcell.
    const allOtherLoadcellsInScope = await this._loadcellRepository.find(
      {
        cluster: targetLoadcell.cluster._id,
        _id: { $ne: targetLoadcell._id },
      },
      { populate: ['bin'] },
    );

    //  Step 3: Handle Re-calibration Scenario (Guard Clause)
    // If the target loadcell is already calibrated, it can only be re-calibrated for the SAME item.
    if (targetLoadcell.state.isCalibrated) {
      if (!targetLoadcell.item || !targetLoadcell.item._id.equals(itemToCalibrate._id)) {
        throw AppHttpException.badRequest({
          message: `Loadcell is already calibrated with a different item. Cannot reassign.`,
        });
      }
      return this._recalibrateExistingItem(targetLoadcell, calibrateData);
    }

    //  Step 4: Handle Item Assignment: Swap or Move only
    // Find the source loadcell that currently holds the item we want to calibrate.
    const sourceLoadcell = allOtherLoadcellsInScope.find((lc) => lc.item!._id.equals(itemToCalibrate._id));

    if (sourceLoadcell) {
      // Case A: Item is found in a `sourceLoadcell`. This is a SWAP or MOVE operation.
      if (sourceLoadcell.state.isCalibrated) {
        throw AppHttpException.badRequest({
          message: `Item "${itemToCalibrate.name}" is already calibrated in loadcell ${sourceLoadcell.id}. Cannot be moved or swapped.`,
        });
      }

      if (targetLoadcell.item) {
        // Subcase A.1: Target loadcell also has an item. This is a true SWAP.
        if (!sourceLoadcell.bin?.id) {
          throw AppHttpException.internalServerError({
            message: `Data Integrity Error: Loadcell ${sourceLoadcell.id} must have a bin to participate in a swap.`,
          });
        }
        const tempItem = sourceLoadcell.itemInfo;
        sourceLoadcell.itemInfo = targetLoadcell.itemInfo;
        targetLoadcell.itemInfo = tempItem;
      } else {
        // Subcase A.2: Target loadcell is empty. This is a MOVE.
        targetLoadcell.itemInfo = sourceLoadcell.itemInfo;
        sourceLoadcell.itemInfo = new LoadcellItem();
      }
    } else {
      // Case B: Item is NOT found elsewhere. THIS IS AN INVALID SCENARIO.
      // If the source loadcell for the item cannot be found within the operational scope,
      // we cannot proceed. The embedded item data (with max, min, etc.) does not exist
      // in this context, and this service cannot create it from scratch.
      throw AppHttpException.badRequest({
        message: `Cannot calibrate with item "${itemToCalibrate.name}". `,
        data: {
          description: `The specified item does not exist on any loadcell within this cluster. Please ensure the item is present in the cluster before calibrating.`,
        },
      });
    }

    //  Step 5: Perform Calculations and Update Loadcell-Specific Data
    // At this point, `targetLoadcell` is guaranteed to hold the correct `item` object.
    if (!targetLoadcell.item || !targetLoadcell.item._id.equals(itemToCalibrate._id)) {
      throw AppHttpException.internalServerError({ message: `Incorrect item on target loadcell after all operations.` });
    }

    // The `item` data block is treated as immutable. We only read from it.
    const { zeroWeight, measuredWeight } = calibrateData;
    const itemData = targetLoadcell.itemInfo;
    const netWeight = measuredWeight - zeroWeight;
    const maxQuantity = itemData.max;
    const unitWeight = maxQuantity > 0 ? netWeight / maxQuantity : 0;
    const calculatedQuantity = unitWeight > 0 ? Math.max(0, Math.floor(netWeight / unitWeight)) : 0;

    // Update only loadcell-specific fields.
    Object.assign(targetLoadcell.calibration, {
      quantity: calculatedQuantity,
      maxQuantity: maxQuantity,
      zeroWeight: zeroWeight,
      unitWeight: unitWeight,
      damageQuantity: 0,
    });

    Object.assign(targetLoadcell.state, {
      isUpdatedWeight: true,
      status: 'idle',
      isCalibrated: true,
    });
    targetLoadcell.bin.unwrap().state.isLocked = true;

    //  Step 6: Persist All Changes
    await this._loadcellRepository.getEntityManager().flush();

    return true;
  }

  /**
   * Handles the logic for re-calibrating an already calibrated loadcell.
   * This is a separate flow that only updates the 'calibration' data block
   * with new reference values. It does not alter the 'reading' data, which
   * is assumed to be updated by a separate hardware-facing process.
   */
  private async _recalibrateExistingItem(loadcell: LoadcellEntity, data: CalibrateLoadcellRequest): Promise<boolean> {
    this._logger.log(`Re-calibrating loadcell ${loadcell.id} for the same item.`);

    const { zeroWeight, measuredWeight } = data;
    const itemData = loadcell.itemInfo!; // We know item exists from the guard clause in the main function.

    //  Step 1: Recalculate Calibration Parameters
    // Calculate the new reference values based on the provided calibration weights.
    const netWeight = measuredWeight - zeroWeight;
    const unitWeight = itemData.max > 0 ? netWeight / itemData.max : 0;

    // This is the theoretical quantity based on the new calibration.
    // It's useful for the calibration record but doesn't reflect the live reading.
    const calculatedQuantity = unitWeight > 0 ? Math.max(0, Math.floor(netWeight / unitWeight)) : 0;

    //  Step 2: Update ONLY the 'calibration' data block
    // The goal is to set a new "standard" for the loadcell.
    // We do NOT touch the `reading` object here.
    Object.assign(loadcell.calibration, {
      quantity: calculatedQuantity, // Update the reference quantity
      maxQuantity: itemData.max, // Re-affirm the max quantity for this calibration event
      zeroWeight: zeroWeight, // Set the new zero-point reference
      unitWeight: unitWeight, // Set the new unit weight reference
    });

    //  Step 3: Persist the changes
    // The @Transactional decorator on the main `calibrate` function will handle the flush.
    // However, if this function could be called independently, an explicit flush is safer.
    // Since it's a private helper in a transactional method, we can rely on the main flush.
    await this._loadcellRepository.getEntityManager().flush(); // This line is optional here.
    return true;
  }
}
