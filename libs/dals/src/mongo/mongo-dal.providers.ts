import { AreaEntity } from './entities/area.entity';
import { BinEntity } from './entities/bin.entity';
import { CabinetEntity } from './entities/cabinet.entity';
import { ClusterEntity } from './entities/cluster.entity';
import { ConditionEntity } from './entities/condition.entity';
import { DepartmentEntity } from './entities/department.entity';
import { FacialRecognitionEntity } from './entities/facial-recognition.entity';
import { IssueHistoryEntity } from './entities/issue-history.entity';
import { ItemTypeEntity } from './entities/item-type.entity';
import { ItemEntity } from './entities/item.entity';
import { LoadcellEntity } from './entities/loadcell.entity';
import { PortEntity } from './entities/port.entity';
import { RoleEntity } from './entities/role.entity';
import { SiteEntity } from './entities/site.entity';
import { SystemEntity } from './entities/system.entity';
import { TabletEntity } from './entities/tablet.entity';
import { TransactionEventEntity } from './entities/transaction-event.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { UserEntity } from './entities/user.entity';

export const ALL_ENTITIES = [
  AreaEntity,
  BinEntity,
  CabinetEntity,
  ClusterEntity,
  ConditionEntity,
  DepartmentEntity,
  FacialRecognitionEntity,
  IssueHistoryEntity,
  ItemEntity,
  ItemTypeEntity,
  LoadcellEntity,
  PortEntity,
  RoleEntity,
  SiteEntity,
  SystemEntity,
  TabletEntity,
  TransactionEntity,
  TransactionEventEntity,
  UserEntity,
];

export const PROCESS_WORKER_ENTITIES = [];

export const SYNC_WORKER_ENTITIES = [];
