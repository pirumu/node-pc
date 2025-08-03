import { AreaModule } from './area';
import { BinModule } from './bin';
import { BinItemModule } from './bin-item';
import { ConditionModule } from './condition';
import { DeviceModule } from './device';
import { ItemModule } from './item';
import { JobCardModule } from './job-card';
// import { TransactionModule } from './transaction';

export const INVENTORY_MODULES = [AreaModule, DeviceModule, BinModule, ConditionModule, ItemModule, BinItemModule, JobCardModule];
