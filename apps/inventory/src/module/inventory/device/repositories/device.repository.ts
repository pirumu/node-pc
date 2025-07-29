import { DeviceEntity, DevicePortEntity, PortDeviceEntity } from '@entity';

export const DEVICE_REPOSITORY_TOKEN = Symbol('IDeviceRepository');

export interface IDeviceRepository {
  findAll(filter: { portId?: string }): Promise<DeviceEntity[]>;
  findAllByBinIdAndItemId(filter: { binId: string; itemId: string }): Promise<DeviceEntity[]>;
  findById(id: string): Promise<DeviceEntity | null>;
  findPortDevices(portId?: string): Promise<PortDeviceEntity[]>;
  create(data: Partial<DeviceEntity>): Promise<DeviceEntity | null>;
  update(id: string, data: Partial<DeviceEntity>): Promise<DeviceEntity | null>;
  delete(id: string): Promise<boolean>;
  reset(id: string, bindId?: string): Promise<boolean>;
  replaceDeviceId(id: string, portId: string, newDeviceNumId: number): Promise<void>;
}
