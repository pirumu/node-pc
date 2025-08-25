import { AreaModule } from './area';
import { BinModule } from './bin';
import { CabinetModule } from './cabinet';
import { ClusterModule } from './cluster';
import { ConditionModule } from './condition';
import { ItemModule } from './item';
import { LoadcellModule } from './loadcell';
// import { JobCardModule } from './working-order';

export const INVENTORY_MODULES = [
  AreaModule,
  BinModule,
  CabinetModule,
  ClusterModule,
  ConditionModule,
  ItemModule,
  // JobCardModule,
  LoadcellModule,
];
