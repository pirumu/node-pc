import { DeviceEntity } from '@entity';

export const LOADCELL_REPOSITORY_TOKEN = Symbol('ILoadcellRepository');

export interface ILoadcellRepository {
  findAll(): Promise<DeviceEntity[]>;
}
