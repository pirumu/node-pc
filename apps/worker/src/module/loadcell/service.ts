// services/LoadcellService.ts
import { ObjectId } from 'mongodb';

import { Device, Port, Bin, Calibration, InventoryTransaction, Item } from '../models';
import {
  MqttPayload,
  QuantityCalculationResult,
  DeviceResponseData,
  CalibrationStartResponse,
  CalibrationZeroResponse,
  CalibrationCompleteResponse,
  CalibrationCompleteInput,
  AlertData,
  AlertType,
  DeviceStatus,
  TransactionType,
  IDevice,
  IDevicePopulated,
  IBin,
  IPort,
  ICalibration,
  IInventoryTransaction,
  LoadcellError,
  CalibrationError,
  DeviceNotFoundError,
} from '../types/interfaces';
import { logger } from '../utils/logger';

// Assuming these are your MongoDB models

export class LoadcellService {
  /**
   * Process weight updates from MQTT
   */
  public async processWeightUpdates(payloads: MqttPayload[]): Promise<DeviceResponseData[]> {
    const results: DeviceResponseData[] = [];

    for (const payload of payloads) {
      try {
        const result = await this.processWeightUpdate(payload);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        logger.error('[LoadcellService] Error processing weight update:', error);
      }
    }

    return results;
  }

  /**
   * Process single weight update
   */
  public async processWeightUpdate(payload: MqttPayload): Promise<DeviceResponseData | null> {
    const { path: hardwarePath, device_id: deviceId, weight: newWeight, status } = payload;

    if (status !== 'running') {
      return null;
    }

    // 1. Find device by hardware path and device ID
    const device = await this.findOrCreateLoadcell(hardwarePath, deviceId);
    if (!device) {
      return null;
    }

    // 2. Update device heartbeat
    await this.updateDeviceHeartbeat(device);

    // 3. Calculate quantity from weight
    const quantityData = await this.calculateQuantityFromWeight(device, newWeight);

    // 4. Update device state
    await this.updateDeviceState(device, newWeight, quantityData);

    // 5. Log transaction
    await this.logInventoryTransaction(device, newWeight, quantityData);

    // 6. Check for alerts
    await this.checkInventoryAlerts(device, quantityData);

    return this.buildResponseData(device, newWeight, quantityData);
  }

  /**
   * Find or create device
   */
  public async findOrCreateLoadcell(hardwarePath: string, deviceId: string): Promise<IDevicePopulated | null> {
    // Find port by hardware path
    const port = (await Port.findOne({ path: hardwarePath })) as IPort | null;
    if (!port) {
      logger.error('[LoadcellService] Port not found:', hardwarePath);
      return null;
    }

    // Find or create device
    let device = (await Device.findOne({
      deviceId,
      portId: port._id,
    }).populate(['bin', 'item', 'calibration'])) as IDevicePopulated | null;

    if (!device) {
      const newDevice = (await Device.create({
        deviceId,
        portId: port._id,
        zeroWeight: 0,
        unitWeight: 0,
        currentWeight: 0,
        calculatedQuantity: 0,
        isCalibrated: false,
        status: DeviceStatus.ONLINE,
        lastHeartbeat: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as IDevice;

      device = newDevice as IDevicePopulated;
    }

    return device;
  }

  /**
   * Calculate quantity from weight using calibration data
   */
  public async calculateQuantityFromWeight(device: IDevicePopulated, newWeight: number): Promise<QuantityCalculationResult> {
    // Check if device is calibrated
    if (!device.isCalibrated || !device.unitWeight || device.unitWeight <= 0) {
      return {
        quantity: 0,
        quantityChange: 0,
        confidence: 0,
        needsCalibration: true,
        error: 'Device not calibrated',
      };
    }

    // Calculate net weight (subtract tare/zero weight)
    const netWeight = newWeight - device.zeroWeight;

    // Calculate raw quantity
    const rawQuantity = netWeight / device.unitWeight;

    // Apply rounding logic (hardware-specific - keep original logic)
    let calculatedQuantity: number;
    if (Math.abs(rawQuantity) === Infinity || isNaN(rawQuantity)) {
      calculatedQuantity = 0;
    } else if (rawQuantity > 0) {
      // For positive values: Math.round(calcNewQuantity - 0.3)
      calculatedQuantity = Math.max(0, Math.round(rawQuantity - 0.3));
    } else {
      // For negative values: Math.round(calcNewQuantity + 0.29)
      calculatedQuantity = Math.min(0, Math.round(rawQuantity + 0.29));
    }

    // Calculate change from previous quantity
    const previousQuantity = device.calculatedQuantity || 0;
    const quantityChange = calculatedQuantity - previousQuantity;

    // Calculate confidence based on weight stability
    const confidence = this.calculateConfidence(device, newWeight);

    return {
      quantity: calculatedQuantity,
      quantityChange,
      confidence,
      needsCalibration: false,
      rawQuantity,
      netWeight,
    };
  }

  /**
   * Calculate confidence score based on weight stability and calibration quality
   */
  public calculateConfidence(device: IDevicePopulated, newWeight: number): number {
    // Base confidence from calibration quality
    let confidence = 0.8; // Default

    // Reduce confidence if weight is very close to zero point
    const netWeight = Math.abs(newWeight - device.zeroWeight);
    if (netWeight < device.unitWeight * 0.1) {
      confidence *= 0.5; // Low confidence near zero
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Update device state with new weight and quantity
   */
  public async updateDeviceState(device: IDevicePopulated, newWeight: number, quantityData: QuantityCalculationResult): Promise<void> {
    const updateData = {
      currentWeight: newWeight,
      calculatedQuantity: quantityData.quantity,
      lastHeartbeat: new Date(),
      status: DeviceStatus.ONLINE,
      updatedAt: new Date(),
    };

    await Device.findByIdAndUpdate(device._id, updateData);

    // Update bin quantity if device is assigned to a bin
    if (device.binId) {
      const binUpdateData: Partial<IBin> = {
        currentQuantity: quantityData.quantity,
        updatedAt: new Date(),
      };

      // Auto update max capacity if current quantity exceeds max
      const bin = (await Bin.findById(device.binId)) as IBin | null;
      if (bin && quantityData.quantity > bin.maxQuantity) {
        binUpdateData.maxQuantity = quantityData.quantity;
        logger.info(`[LoadcellService] Auto updated max capacity for bin ${bin.binCode}: ${bin.maxQuantity} -> ${quantityData.quantity}`);
      }

      await Bin.findByIdAndUpdate(device.binId, binUpdateData);
    }
  }

  /**
   * Log inventory transaction
   */
  public async logInventoryTransaction(
    device: IDevicePopulated,
    newWeight: number,
    quantityData: QuantityCalculationResult,
  ): Promise<void> {
    const transactionData: Partial<IInventoryTransaction> = {
      deviceId: device._id,
      binId: device.binId,
      itemId: device.item?._id,
      type: TransactionType.WEIGHT_CHANGE,
      previousQuantity: device.calculatedQuantity || 0,
      newQuantity: quantityData.quantity,
      quantityChange: quantityData.quantityChange,
      previousWeight: device.currentWeight || 0,
      newWeight: newWeight,
      weightChange: newWeight - (device.currentWeight || 0),
      confidence: quantityData.confidence,
      isValidated: false,
      triggeredBy: 'mqtt',
      timestamp: new Date(),
    };

    await InventoryTransaction.create(transactionData);
  }

  /**
   * Check for inventory alerts (low stock, etc.)
   */
  public async checkInventoryAlerts(device: IDevicePopulated, quantityData: QuantityCalculationResult): Promise<void> {
    if (!device.binId) {
      return;
    }

    const bin = (await Bin.findById(device.binId)) as IBin | null;
    if (!bin) {
      return;
    }

    // Low stock alert
    if (quantityData.quantity <= bin.minQuantity) {
      await this.triggerAlert(AlertType.LOW_STOCK, {
        deviceId: device._id,
        binId: bin._id,
        currentQuantity: quantityData.quantity,
        minQuantity: bin.minQuantity,
      });
    }

    // High confidence change alert (sudden quantity change)
    if (Math.abs(quantityData.quantityChange) > 5 && quantityData.confidence > 0.8) {
      await this.triggerAlert(AlertType.QUANTITY_CHANGE, {
        deviceId: device._id,
        quantityChange: quantityData.quantityChange,
        confidence: quantityData.confidence,
      });
    }
  }

  /**
   * Update device heartbeat
   */
  public async updateDeviceHeartbeat(device: IDevicePopulated): Promise<void> {
    await Device.findByIdAndUpdate(device._id, {
      lastHeartbeat: new Date(),
      status: DeviceStatus.ONLINE,
      updatedAt: new Date(),
    });

    // Also update port heartbeat
    await Port.findByIdAndUpdate(device.portId, {
      lastHeartbeat: new Date(),
      status: 'online',
    });
  }

  /**
   * Build response data
   */
  public buildResponseData(device: IDevicePopulated, newWeight: number, quantityData: QuantityCalculationResult): DeviceResponseData {
    return {
      id: device._id,
      deviceId: device.deviceId,
      portId: device.portId as ObjectId,
      binId: device.binId,
      weight: newWeight,
      quantity: quantityData.quantity,
      quantityChange: quantityData.quantityChange,
      confidence: quantityData.confidence,
      needsCalibration: quantityData.needsCalibration,
      status: DeviceStatus.ONLINE,
      timestamp: new Date(),
    };
  }

  /**
   * Trigger alert (placeholder - implement based on your alert system)
   */
  public async triggerAlert(type: AlertType, data: AlertData): Promise<void> {
    // Implement your alert system here
    logger.info(`Alert [${type}]:`, data);
  }
}

// =================================
// CALIBRATION SERVICE
// =================================

export class CalibrationService {
  /**
   * Start calibration process
   * Step 1: Record zero weight (empty loadcell)
   */
  public async startCalibration(deviceId: ObjectId, userId: ObjectId): Promise<CalibrationStartResponse> {
    const device = (await Device.findById(deviceId)) as IDevice | null;
    if (!device) {
      throw new DeviceNotFoundError(deviceId.toString());
    }

    // Set device to calibration mode
    await Device.findByIdAndUpdate(deviceId, {
      status: DeviceStatus.CALIBRATING,
      isCalibrated: false,
      updatedAt: new Date(),
    });

    return {
      message: 'Calibration started. Please ensure loadcell is empty and confirm.',
      step: 'zero_weight' as any,
      deviceId,
    };
  }

  /**
   * Record zero weight (tare)
   */
  public async recordZeroWeight(deviceId: ObjectId, currentWeight: number): Promise<CalibrationZeroResponse> {
    await Device.findByIdAndUpdate(deviceId, {
      zeroWeight: currentWeight,
      updatedAt: new Date(),
    });

    return {
      message: 'Zero weight recorded. Now place known quantity of items and confirm.',
      step: 'unit_weight' as any,
      zeroWeight: currentWeight,
    };
  }

  /**
   * Complete calibration with known quantity
   * Formula: unitWeight = (currentWeight - zeroWeight) / knownQuantity
   */
  public async completeCalibration(input: CalibrationCompleteInput): Promise<CalibrationCompleteResponse> {
    const { deviceId, itemId, knownQuantity, currentWeight, userId } = input;

    const device = (await Device.findById(deviceId)) as IDevice | null;
    if (!device) {
      throw new DeviceNotFoundError(deviceId.toString());
    }

    if (device.zeroWeight === undefined || device.zeroWeight === null) {
      throw new CalibrationError('Zero weight not recorded. Please start calibration from beginning.');
    }

    // Calculate unit weight: weight per 1 item
    // Example: zeroWeight=100g, currentWeight=150g, knownQuantity=5
    // unitWeight = (150-100)/5 = 10g per item
    const netWeight = currentWeight - device.zeroWeight;
    const unitWeight = netWeight / knownQuantity;

    if (unitWeight <= 0) {
      throw new CalibrationError('Invalid unit weight. Please check your measurements.');
    }

    // Update device
    await Device.findByIdAndUpdate(deviceId, {
      unitWeight,
      itemId,
      isCalibrated: true,
      calibratedAt: new Date(),
      calibratedBy: userId,
      status: DeviceStatus.ONLINE,
      updatedAt: new Date(),
    });

    // Record calibration
    const calibrationData: Partial<ICalibration> = {
      deviceId,
      itemId,
      zeroWeight: device.zeroWeight,
      knownQuantity,
      weightWithItems: currentWeight,
      calculatedUnitWeight: unitWeight,
      accuracy: 0.95, // Could be calculated based on multiple measurements
      isActive: true,
      calibratedBy: userId,
      calibratedAt: new Date(),
    };

    await Calibration.create(calibrationData);

    return {
      message: 'Calibration completed successfully',
      unitWeight,
      zeroWeight: device.zeroWeight,
      netWeight,
      accuracy: 0.95,
    };
  }

  /**
   * Reset calibration for a device
   */
  public async resetCalibration(deviceId: ObjectId): Promise<{ message: string }> {
    // Mark current calibration as inactive
    await Calibration.updateMany({ deviceId, isActive: true }, { isActive: false });

    // Reset device calibration
    await Device.findByIdAndUpdate(deviceId, {
      isCalibrated: false,
      unitWeight: 0,
      zeroWeight: 0,
      status: DeviceStatus.OFFLINE,
      updatedAt: new Date(),
    });

    return { message: 'Device calibration reset. Please recalibrate.' };
  }

  /**
   * Get calibration history for a device
   */
  public async getCalibrationHistory(deviceId: ObjectId): Promise<ICalibration[]> {
    return (await Calibration.find({ deviceId })
      .populate('item', 'name sku')
      .populate('calibratedBy', 'name email')
      .sort({ calibratedAt: -1 })) as ICalibration[];
  }
}
