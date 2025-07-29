import { DeviceEntity } from '@entity';

export const LOADCELL_REPOSITORY_TOKEN = Symbol('ILoadcellRepository');

export interface ILoadcellRepository {
  findByBinId(binId: string): Promise<DeviceEntity[]>;
  findByDeviceId(deviceId: string): Promise<DeviceEntity | null>;
  findAll(): Promise<DeviceEntity[]>;
}
