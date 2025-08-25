import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Repository } from '@mikro-orm/core';
import { Transactional } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNumber } from 'class-validator';

import { LoadcellEntity, LoadcellItem, CalibrationData, LiveReading, LoadcellState } from './loadcell.entity';
import { BinEntity } from './bin.entity';
import { ItemEntity } from './item.entity';

export class CalibrateLoadcellRequest {
@ApiProperty({ description: 'Item ID to assign to loadcell' })
@IsMongoId()
itemId: string;

@ApiProperty({ description: 'Current weight reading from sensor' })
@IsNumber()
currentWeight: number;

@ApiProperty({ description: 'Zero weight for calibration' })
@IsNumber()
zeroWeight: number;

@ApiProperty({ description: 'Calculated weight after processing' })
@IsNumber()
calculatedWeight: number;
}

export class ItemConflictError {
@ApiProperty()
type: 'ITEM_CONFLICT' | 'ITEM_REPLACE';

@ApiProperty()
message: string;

@ApiProperty()
conflictLoadcellId?: string;

@ApiProperty()
currentLoadcellId: string;

@ApiProperty()
itemId: string;

@ApiProperty()
currentItemId?: string;

@ApiProperty()
newItemId?: string;

@ApiProperty()
canForceAssign: boolean;

@ApiProperty()
forceAssignOption: boolean;
}

export class CalibrateLoadcellResponse {
@ApiProperty({ description: 'Success status' })
success: boolean;

@ApiProperty({ description: 'Calibrated loadcell data' })
loadcell: {
id: string;
hardwareId: number;
item: LoadcellItem;
calibration: CalibrationData;
reading: LiveReading;
state: LoadcellState;
};

@ApiPropertyOptional({ description: 'Transfer info if force assign was used' })
transferInfo?: {
fromLoadcellId: string;
message: string;
};
}

@Injectable()
export class LoadcellCalibrateService {
constructor(
@InjectRepository(LoadcellEntity)
private readonly loadcellRepository: Repository<LoadcellEntity>,

    @InjectRepository(BinEntity)
    private readonly binRepository: Repository<BinEntity>,
    
    @InjectRepository(ItemEntity)
    private readonly itemRepository: Repository<ItemEntity>,
) {}

/**
* Calibrate loadcell - Auto swap if transaction-safe
* Only blocks if it violates transaction integrity
  */
  @Transactional()
  async calibrateLoadcell(loadcellId: string, calibrateData: CalibrateLoadcellRequest): Promise<CalibrateLoadcellResponse> {
  const { itemId, currentWeight, zeroWeight, calculatedWeight } = calibrateData;

    // 1. Find and validate loadcell
    const loadcell = await this.loadcellRepository.findOne(
      { id: new ObjectId(loadcellId) },
      { populate: ['bin'] }
    );

    if (!loadcell) {
      throw new NotFoundException('Loadcell not found');
    }

    if (!loadcell.bin?.id) {
      throw new BadRequestException('Loadcell must be linked to a bin before calibration');
    }

    // 2. Validate item exists
    const item = await this.itemRepository.findOne({ id: new ObjectId(itemId) });
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }

    // 3. If loadcell already calibrated - check if same item (recalibration)
    if (loadcell.state.isCalibrated) {
      if (!loadcell.item || !loadcell.item.itemId.equals(new ObjectId(itemId))) {
        throw new BadRequestException(
          `Loadcell is already calibrated with a different item. ` +
          `Cannot reassign calibrated loadcells due to transaction integrity.`
        );
      }
      
      // Same item - recalibrate (update readings only)
      return await this.recalibrateExistingItem(loadcell, calibrateData);
    }

    // 4. Check where this item is currently assigned in this bin
    const binId = loadcell.bin.id;
    const currentAssignment = await this.loadcellRepository.findOne({
      'bin.id': binId,
      'item.itemId': new ObjectId(itemId)
    });

    if (currentAssignment) {
      // Item is already assigned somewhere in this bin
      if (currentAssignment.id.equals(new ObjectId(loadcellId))) {
        // Same loadcell - check if we can proceed
        if (loadcell.state.isCalibrated) {
          // Recalibrate same item on same loadcell
          return await this.recalibrateExistingItem(loadcell, calibrateData);
        }
        // Same loadcell, not calibrated yet - continue normal calibration
      } else {
        // Item is assigned to different loadcell
        if (currentAssignment.state.isCalibrated) {
          // CRITICAL: Item is calibrated elsewhere - REJECT
          throw new BadRequestException(
            `Item "${item.name}" is already calibrated in loadcell ${currentAssignment.id.toString()}. ` +
            `Cannot transfer calibrated items due to transaction integrity.`
          );
        } else {
          // Item is in uncalibrated loadcell - AUTO CLEAR and transfer
          await this.clearUncalibratedLoadcell(currentAssignment);
        }
      }
    }

    // 5. AUTO-CLEAR: Current loadcell if has different item (no warning needed)
    if (loadcell.item && !loadcell.item.itemId.equals(new ObjectId(itemId))) {
      // Just clear current item - user intent is clear
      loadcell.item = undefined;
    }

    // 6. Perform calibration
    const netWeight = calculatedWeight - zeroWeight;
    const maxQuantity = 100;
    const minQuantity = 20;
    const criticalQuantity = 10;
    const unitWeight = maxQuantity > 0 ? netWeight / maxQuantity : 0;
    const calculatedQuantity = unitWeight > 0 ? Math.max(0, Math.floor(netWeight / unitWeight)) : 0;

    // 7. Create/Update loadcell item
    if (!loadcell.item) {
      loadcell.item = new LoadcellItem();
    }

    loadcell.item.itemId = new ObjectId(itemId);
    loadcell.item.qty = calculatedQuantity;
    loadcell.item.max = maxQuantity;
    loadcell.item.min = minQuantity;
    loadcell.item.critical = criticalQuantity;
    loadcell.item.description = item.description || '';
    loadcell.item.barcode = '';
    loadcell.item.rfid = '';
    loadcell.item.serialNumber = '';
    loadcell.item.batchNumber = '';

    // 8. Update calibration data
    loadcell.calibration.quantity = calculatedQuantity;
    loadcell.calibration.maxQuantity = maxQuantity;
    loadcell.calibration.zeroWeight = zeroWeight;
    loadcell.calibration.unitWeight = unitWeight;
    loadcell.calibration.damageQuantity = 0;

    // 9. Update reading data
    loadcell.reading.currentWeight = currentWeight;
    loadcell.reading.calculatedWeight = calculatedWeight;
    loadcell.reading.calculatedQuantity = calculatedQuantity;

    // 10. LOCK THE CALIBRATION - becomes immutable for transaction integrity
    loadcell.state.isUpdatedWeight = true;
    loadcell.state.status = 'calibrated';
    loadcell.state.isCalibrated = true;

    // 11. Update bin state
    loadcell.bin.state.isLocked = true;

    // 12. Save changes
    await this.loadcellRepository.persistAndFlush(loadcell);
    await this.binRepository.persistAndFlush(loadcell.bin);

    return {
      success: true,
      loadcell: {
        id: loadcell.id.toString(),
        hardwareId: loadcell.hardwareId,
        item: loadcell.item,
        calibration: loadcell.calibration,
        reading: loadcell.reading,
        state: loadcell.state
      }
    };
}

/**
* Reset loadcell calibration - allows recalibration
  */
  @Transactional()
  async resetCalibration(loadcellId: string): Promise<{ success: boolean; message: string }> {
  const loadcell = await this.loadcellRepository.findOneOrFail({
  id: new ObjectId(loadcellId)
  });

    if (!loadcell.state.isCalibrated) {
      throw new BadRequestException('Loadcell is not calibrated, nothing to reset');
    }

    // Reset calibration data
    loadcell.calibration.quantity = 0;
    loadcell.calibration.maxQuantity = 0;
    loadcell.calibration.zeroWeight = 0;
    loadcell.calibration.unitWeight = 0;
    loadcell.calibration.damageQuantity = 0;
    
    // Reset reading data
    loadcell.reading.currentWeight = 0;
    loadcell.reading.calculatedWeight = 0;
    loadcell.reading.calculatedQuantity = 0;
    
    // Reset state - ALLOW RECALIBRATION
    loadcell.state.isCalibrated = false;
    loadcell.state.status = 'idle';
    loadcell.state.isUpdatedWeight = false;

    // Keep item data - user might want to recalibrate same item
    // Keep bin assignment - loadcell stays in bin

    await this.loadcellRepository.persistAndFlush(loadcell);

    return { 
      success: true, 
      message: 'Calibration reset successfully. Loadcell can now be recalibrated.' 
    };
}

/**
* Update weight reading only - for continuous monitoring
* Only works if loadcell is already calibrated
  */
  @Transactional()
  async updateWeightReading(loadcellId: string, currentWeight: number): Promise<void> {
  const loadcell = await this.loadcellRepository.findOneOrFail({
  id: new ObjectId(loadcellId)
  });

    if (!loadcell.state.isCalibrated) {
      throw new BadRequestException('Loadcell must be calibrated before updating weight readings');
    }

    // Update current weight
    loadcell.reading.currentWeight = currentWeight;
    
    // Recalculate based on existing calibration
    const netWeight = currentWeight - loadcell.calibration.zeroWeight;
    loadcell.reading.calculatedWeight = netWeight;
    
    // Calculate quantity using existing unit weight
    if (loadcell.calibration.unitWeight > 0) {
      const newQuantity = Math.max(0, Math.floor(netWeight / loadcell.calibration.unitWeight));
      loadcell.reading.calculatedQuantity = newQuantity;
      
      // Update item quantity if item exists
      if (loadcell.item) {
        loadcell.item.qty = newQuantity;
      }
    }

    loadcell.state.isUpdatedWeight = true;

    await this.loadcellRepository.persistAndFlush(loadcell);
}

/**
* Get calibration status for UI
  */
  async getCalibrationStatus(loadcellId: string): Promise<{
  isCalibrated: boolean;
  isAssignedToBin: boolean;
  hasItem: boolean;
  canCalibrate: boolean;
  currentReading: LiveReading;
  calibration: CalibrationData;
  itemInfo?: {
  id: string;
  name: string;
  description: string;
  };
  messages: string[];
  }> {
  const loadcell = await this.loadcellRepository.findOne(
  { id: new ObjectId(loadcellId) },
  { populate: ['bin'] }
  );

    if (!loadcell) {
      throw new NotFoundException('Loadcell not found');
    }

    const messages: string[] = [];
    const isAssignedToBin = !!loadcell.bin?.id;
    const hasItem = !!loadcell.item;
    const isCalibrated = loadcell.state.isCalibrated;

    // Determine if can calibrate
    let canCalibrate = true;
    if (!isAssignedToBin) {
      canCalibrate = false;
      messages.push('Loadcell must be assigned to a bin first');
    }
    if (isCalibrated) {
      canCalibrate = false;
      messages.push('Loadcell is already calibrated. Reset calibration to recalibrate.');
    }

    // Get item info if exists
    let itemInfo;
    if (hasItem && loadcell.item) {
      const item = await this.itemRepository.findOne({ id: loadcell.item.itemId });
      if (item) {
        itemInfo = {
          id: item.id.toString(),
          name: item.name,
          description: item.description
        };
      }
    }

    return {
      isCalibrated,
      isAssignedToBin,
      hasItem,
      canCalibrate,
      currentReading: loadcell.reading,
      calibration: loadcell.calibration,
      itemInfo,
      messages
    };
}

/**
* Recalibrate existing item - only update weight readings
  */
  private async recalibrateExistingItem(
  loadcell: LoadcellEntity,
  calibrateData: CalibrateLoadcellRequest
  ): Promise<CalibrateLoadcellResponse> {
  const { currentWeight, zeroWeight, calculatedWeight } = calibrateData;

    // Keep existing item data, only update calibration readings
    const netWeight = calculatedWeight - zeroWeight;
    const existingMaxQty = loadcell.item!.max;
    const unitWeight = existingMaxQty > 0 ? netWeight / existingMaxQty : 0;
    const calculatedQuantity = unitWeight > 0 ? Math.max(0, Math.floor(netWeight / unitWeight)) : 0;

    // Update only readings and calibration weight data
    loadcell.calibration.zeroWeight = zeroWeight;
    loadcell.calibration.unitWeight = unitWeight;
    loadcell.calibration.quantity = calculatedQuantity;

    loadcell.reading.currentWeight = currentWeight;
    loadcell.reading.calculatedWeight = calculatedWeight;
    loadcell.reading.calculatedQuantity = calculatedQuantity;

    // Update item quantity
    loadcell.item!.qty = calculatedQuantity;

    loadcell.state.isUpdatedWeight = true;

    await this.loadcellRepository.persistAndFlush(loadcell);

    return {
      success: true,
      loadcell: {
        id: loadcell.id.toString(),
        hardwareId: loadcell.hardwareId,
        item: loadcell.item!,
        calibration: loadcell.calibration,
        reading: loadcell.reading,
        state: loadcell.state
      }
    };
}

/**
* Clear uncalibrated loadcell automatically (safe operation)
  */
  private async clearUncalibratedLoadcell(loadcell: LoadcellEntity): Promise<void> {
  // Safe to clear since not calibrated
  loadcell.item = undefined;
  loadcell.calibration.quantity = 0;
  loadcell.calibration.maxQuantity = 0;
  loadcell.calibration.zeroWeight = 0;
  loadcell.calibration.unitWeight = 0;
  loadcell.calibration.damageQuantity = 0;
  loadcell.reading.currentWeight = 0;
  loadcell.reading.calculatedWeight = 0;
  loadcell.reading.calculatedQuantity = 0;
  loadcell.state.isCalibrated = false;
  loadcell.state.status = 'idle';
  loadcell.state.isUpdatedWeight = false;

    await this.loadcellRepository.persistAndFlush(loadcell);
}
@Transactional()
async clearItem(loadcellId: string): Promise<{ success: boolean }> {
const loadcell = await this.loadcellRepository.findOneOrFail({
id: new ObjectId(loadcellId)
});

    if (!loadcell.item) {
      throw new BadRequestException('Loadcell has no item to clear');
    }

    // Clear item data
    loadcell.item = undefined;
    
    // Reset calibration to allow new item
    loadcell.state.isCalibrated = false;
    loadcell.state.status = 'idle';
    
    // Clear item-related calibration data
    loadcell.calibration.quantity = 0;
    loadcell.calibration.maxQuantity = 0;
    loadcell.reading.calculatedQuantity = 0;

    await this.loadcellRepository.persistAndFlush(loadcell);

    return { success: true };
}
}
