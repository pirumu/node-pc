import { SerialOptions } from '@serialport/serial';

export type LoadCellDevice = {
  no: number;
  data: string;
  quantity: number;
  dataLength: number;
};

export type LoadCellReading = {
  path: string;
  deviceId: number;
  rawDeviceId: number;
  weight: number;
  status: 'running' | 'error';
  timestamp: Date;
  rawData: number[];
};

export type LoadCellConfig = {
  enabled: boolean;
  logLevel: number;
  precision: number;
  initTimer: number;
  charStart: number;
  messageLength: number;
  serialOptions: SerialOptions;
  discoveryTimeout: number;
  pollingInterval: number;
};

export type LoadCellStats = {
  totalMessages: number;
  onlineDevices: number[];
  activeMessages: number;
  readingsCount: number;
  errorsCount: number;
  lastReading?: Date;
};

// Hook types
export type LoadCellDataHandler = (reading: LoadCellReading) => void | Promise<void>;
export type LoadCellErrorHandler = (error: Error, context?: string) => void;
export type DeviceDiscoveryHandler = (deviceId: number, isOnline: boolean) => void;

export type LoadCellHooks = {
  onData?: LoadCellDataHandler;
  onError?: LoadCellErrorHandler;
  onDeviceDiscovery?: DeviceDiscoveryHandler;
  onStatusChange?: (isRunning: boolean) => void;
};

// monitoring
// ==================== TYPES ====================

export type DeviceHeartbeat = {
  deviceId: number;
  lastSeen: number; // timestamp
  isConnected: boolean;
  source: 'loadcell';
  metadata?: any;
};

export type DeviceStatusPayload = {
  id: number;
  deviceId: number;
  isConnected: boolean;
  lastSeen?: number;
  source?: string;
  metadata?: any;
};

export type HealthMonitoringConfig = {
  enabled: boolean;
  checkInterval: number; // ms
  heartbeatTimeout: number; // ms
  logConnectionChanges: boolean;
};

export type DeviceHealthStats = {
  totalDevices: number;
  connectedDevices: number;
  disconnectedDevices: number;
  loadCellDevices: number;
  lastCheck: Date;
};

export type DeviceConnectionEvent = {
  deviceId: number;
  isConnected: boolean;
  previousState?: boolean;
  source: string;
  timestamp: Date;
  metadata?: any;
};

// Hook types for device health monitoring
export type DeviceStatusHandler = (status: DeviceStatusPayload) => void | Promise<void>;
export type DeviceConnectionHandler = (event: DeviceConnectionEvent) => void | Promise<void>;
export type HealthStatsHandler = (stats: DeviceHealthStats) => void | Promise<void>;
export type DeviceErrorHandler = (error: Error, deviceId?: number, context?: string) => void;

export type DeviceHealthHooks = {
  onDeviceStatus?: DeviceStatusHandler;
  onConnectionChange?: DeviceConnectionHandler;
  onHealthStats?: HealthStatsHandler;
  onError?: DeviceErrorHandler;
  onBatchStatus?: (statuses: DeviceStatusPayload[]) => void | Promise<void>;
};

export type LoadcellsModuleOptions = {
  loadCellConfig: Partial<LoadCellConfig>;
  healthMonitoringConfig: Partial<HealthMonitoringConfig>;
};

export type LoadcellsModuleAsyncOptions = {
  useFactory?: (...args: any[]) => Promise<LoadcellsModuleOptions> | LoadcellsModuleOptions;
  inject?: any[];
  imports?: any[];
};
