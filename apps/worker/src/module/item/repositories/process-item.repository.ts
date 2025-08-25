import { BinEntity, DeviceEntity, TransactionEntity } from '@entity';
import { Properties } from '@framework/types';

export const PROCESS_ITEM_REPOSITORY_TOKEN = 'IProcessItemRepository';

export interface IProcessItemRepository {
  findTransactionById(id: string): Promise<TransactionEntity | null>;
  createTransaction(entity: TransactionEntity): Promise<TransactionEntity>;
  addLogDataToTransaction(transactionId: string, logData: any): Promise<TransactionEntity>;
  updateTransaction(id: string, entity: Partial<Properties<TransactionEntity>>): Promise<TransactionEntity | null>;
  findBinById(binId: string): Promise<BinEntity | null>;
  findDeviceByBinId(binId: string): Promise<DeviceEntity | null>;
  findDeviceById(id: string): Promise<DeviceEntity | null>;
  findDevicesByBinId(binId: string): Promise<DeviceEntity[]>;
  updateDeviceZeroWeightByBinId(binId: string): Promise<boolean>;
  findDevicesWithPort(binId?: string): Promise<{ device: DeviceEntity; portPath: string }[]>;

  updateBinOpenStatus(bin: { id: string } & Partial<Properties<BinEntity>>): Promise<BinEntity | null>;

  updateDevicesDamageQty(deviceIds: string[], damageItems: Array<{ deviceId: string; damageQty: number }>): Promise<void>;
  updateBinsDamage(binIds: string[]): Promise<boolean>;
}
