// types/interfaces.ts
import { ObjectId } from 'mongodb';

// ========================
// ENUMS
// ========================

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  CALIBRATING = 'calibrating',
  ERROR = 'error',
}

export enum TransactionType {
  WEIGHT_CHANGE = 'weight_change',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  CALIBRATION = 'calibration',
}

export enum AlertType {
  LOW_STOCK = 'low_stock',
  QUANTITY_CHANGE = 'quantity_change',
  CALIBRATION_NEEDED = 'calibration_needed',
}

export enum CalibrationStep {
  ZERO_WEIGHT = 'zero_weight',
  UNIT_WEIGHT = 'unit_weight',
  COMPLETED = 'completed',
}

// ========================
// DATABASE INTERFACES
// ========================

export interface IDevice {
  _id: ObjectId;
  deviceId: string;
  portId: ObjectId;
  binId?: ObjectId;

  // Weight Calibration Data
  zeroWeight: number;
  unitWeight: number;
  maxCapacity?: number;

  // Current State
  currentWeight: number;
  calculatedQuantity: number;
  lastHeartbeat: Date;
  status: DeviceStatus;

  // Calibration Status
  isCalibrated: boolean;
  calibratedAt?: Date;
  calibratedBy?: ObjectId;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface ICalibration {
  _id: ObjectId;
  deviceId: ObjectId;
  itemId: ObjectId;

  // Calibration Points
  zeroWeight: number;
  knownQuantity: number;
  weightWithItems: number;
  calculatedUnitWeight: number;

  // Validation
  accuracy: number;
  isActive: boolean;

  calibratedBy: ObjectId;
  calibratedAt: Date;
}

export interface IItem {
  _id: ObjectId;
  sku: string;
  name: string;

  // Weight Properties
  averageWeight?: number;
  weightTolerance?: number;

  // Physical Properties
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };

  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBin {
  _id: ObjectId;
  binCode: string;
  itemId?: ObjectId;

  // Capacity - auto update max khi quantity vượt
  maxQuantity: number;
  minQuantity: number;
  currentQuantity: number;

  // Lock status
  isLocked: boolean;
  lockedAt?: Date;
  lockedBy?: ObjectId;

  // Location
  warehouseId?: ObjectId;
  zone?: string;
  row?: string;
  shelf?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryTransaction {
  _id: ObjectId;
  deviceId: ObjectId;
  binId?: ObjectId;
  itemId?: ObjectId;

  // Transaction Data
  type: TransactionType;
  previousQuantity: number;
  newQuantity: number;
  quantityChange: number;

  // Weight Data
  previousWeight: number;
  newWeight: number;
  weightChange: number;

  // Confidence & Validation
  confidence: number;
  isValidated: boolean;

  // Metadata
  triggeredBy: string;
  timestamp: Date;
  notes?: string;
}

export interface IPort {
  _id: ObjectId;
  path: string;
  nucId?: string;
  lastHeartbeat: Date;
  status: string;
  createdAt: Date;
}

// ========================
// API REQUEST/RESPONSE TYPES
// ========================

export interface MqttPayload {
  path: string;
  device_id: string;
  weight: number;
  status: string;
}

export interface QuantityCalculationResult {
  quantity: number;
  quantityChange: number;
  confidence: number;
  needsCalibration: boolean;
  rawQuantity?: number;
  netWeight?: number;
  error?: string;
}

export interface DeviceResponseData {
  id: ObjectId;
  deviceId: string;
  portId: ObjectId;
  binId?: ObjectId;
  weight: number;
  quantity: number;
  quantityChange: number;
  confidence: number;
  needsCalibration: boolean;
  status: DeviceStatus;
  timestamp: Date;
}

export interface CalibrationStartResponse {
  message: string;
  step: CalibrationStep;
  deviceId: ObjectId;
}

export interface CalibrationZeroResponse {
  message: string;
  step: CalibrationStep;
  zeroWeight: number;
}

export interface CalibrationCompleteResponse {
  message: string;
  unitWeight: number;
  zeroWeight: number;
  netWeight: number;
  accuracy: number;
}

export interface AlertData {
  deviceId: ObjectId;
  binId?: ObjectId;
  currentQuantity?: number;
  minQuantity?: number;
  quantityChange?: number;
  confidence?: number;
}

// ========================
// SERVICE INPUT TYPES
// ========================

export interface CalibrationCompleteInput {
  deviceId: ObjectId;
  itemId: ObjectId;
  knownQuantity: number;
  currentWeight: number;
  userId: ObjectId;
}

export interface DeviceCalibrationInfo {
  id: ObjectId;
  deviceId: string;
  portPath?: string;
  binCode?: string;
  itemName?: string;
  isCalibrated: boolean;
  calibratedAt?: Date;
  unitWeight: number;
  zeroWeight: number;
  currentWeight: number;
  calculatedQuantity: number;
  status: DeviceStatus;
  lastHeartbeat: Date;
}

// ========================
// VALIDATION SCHEMAS (for use with joi/zod)
// ========================

export interface CalibrationValidation {
  deviceId: string;
  itemId?: string;
  knownQuantity?: number;
  currentWeight?: number;
}

// ========================
// POPULATED INTERFACES (for MongoDB populate)
// ========================

export interface IDevicePopulated extends Omit<IDevice, 'portId' | 'binId'> {
  port?: IPort;
  bin?: IBin;
  item?: IItem;
  calibration?: ICalibration;
}

export interface ICalibrationPopulated extends Omit<ICalibration, 'itemId' | 'calibratedBy'> {
  item?: Pick<IItem, 'name' | 'sku'>;
  calibratedBy?: {
    name: string;
    email: string;
  };
}

// ========================
// ERROR TYPES
// ========================

export class LoadcellError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'LoadcellError';
  }
}

export class CalibrationError extends LoadcellError {
  constructor(message: string, code: string = 'CALIBRATION_ERROR') {
    super(message, code, 400);
    this.name = 'CalibrationError';
  }
}

export class DeviceNotFoundError extends LoadcellError {
  constructor(deviceId: string) {
    super(`Device not found: ${deviceId}`, 'DEVICE_NOT_FOUND', 404);
    this.name = 'DeviceNotFoundError';
  }
}
