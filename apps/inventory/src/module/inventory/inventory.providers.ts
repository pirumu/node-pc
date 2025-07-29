import { AreaModule } from './area';
import { BinModule } from './bin';
import { BinItemModule } from './bin-item';
import { ConditionModule } from './condition';
import { DeviceModule } from './device';
import { ItemModule } from './item';
import { TransactionModule } from './transaction';

export const INVENTORY_MODULES = [AreaModule, DeviceModule, BinModule, ConditionModule, ItemModule, TransactionModule, BinItemModule];
