import { BinEntity, DeviceEntity } from '@entity';

export const BIN_REPOSITORY_TOKEN = Symbol('IBinRepository');

export interface IBinRepository {
  findAll(filter: Partial<BinEntity>): Promise<BinEntity[]>;
  findById(id: string): Promise<BinEntity | null>;
  create(data: Partial<BinEntity>): Promise<BinEntity>;
  update(id: string, data: Partial<BinEntity>): Promise<BinEntity | null>;
  updateBinOpenStatus(id: string, data: Partial<BinEntity>, options?: { withDevice: Partial<DeviceEntity> }): Promise<boolean>;
  updateBinsOpenStatus(data: Partial<BinEntity>[], options?: { withDevice: Partial<DeviceEntity> }): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}
