import { ModelDefinition } from '@nestjs/mongoose';

import {
  AreaMRepository,
  BinItemMRepository,
  BinMRepository,
  CabinetMRepository,
  CardMRepository,
  ConditionMRepository,
  DeviceMRepository,
  FingerprintMRepository,
  ItemMRepository,
  ItemTypeMRepository,
  JobCardMRepository,
  LogMRepository,
  MetaDataMRepository,
  PortMRepository,
  ReturnItemMRepository,
  SiteMRepository,
  SiteUserMRepository,
  TabletMRepository,
  TransactionMRepository,
  UserMRepository,
} from './repositories';
import { AreaModel } from './schema/area.schema';
import { BinItemModel } from './schema/bin-item.schema';
import { BinModel } from './schema/bin.schema';
import { CabinetModel } from './schema/cabinet.schema';
import { CardModel } from './schema/card.schema';
import { ConditionModel } from './schema/condition.schema';
import { DeviceModel } from './schema/device.schema';
import { FingerprintModel } from './schema/fingerprint.schema';
import { ItemTypeModel } from './schema/item-type.schema';
import { ItemModel } from './schema/item.schema';
import { JobCardModel } from './schema/job-card.schema';
import { LogModel } from './schema/log.schema';
import { MetaDataModel } from './schema/meta-data.schema';
import { PortModel } from './schema/port.schema';
import { ReturnItemModel } from './schema/return-item.schema';
import { SiteUserModel } from './schema/site-user.schema';
import { SiteModel } from './schema/site.schema';
import { TabletModel } from './schema/tablet.schema';
import { TransactionModel } from './schema/transaction.schema';
import { UserModel } from './schema/user.schema';

export const API_MODELS: ModelDefinition[] = [
  AreaModel,
  BinModel,
  BinItemModel,
  CabinetModel,
  CardModel,
  ConditionModel,
  DeviceModel,
  FingerprintModel,
  ItemModel,
  ItemTypeModel,
  JobCardModel,
  LogModel,
  MetaDataModel,
  PortModel,
  ReturnItemModel,
  SiteModel,
  SiteUserModel,
  TabletModel,
  TransactionModel,
  UserModel,
];

export const API_MONGO_REPOSITORIES = [
  AreaMRepository,
  BinMRepository,
  BinItemMRepository,
  CabinetMRepository,
  CardMRepository,
  ConditionMRepository,
  DeviceMRepository,
  FingerprintMRepository,
  ItemMRepository,
  ItemTypeMRepository,
  JobCardMRepository,
  LogMRepository,
  MetaDataMRepository,
  PortMRepository,
  ReturnItemMRepository,
  SiteMRepository,
  SiteUserMRepository,
  TabletMRepository,
  TransactionMRepository,
  UserMRepository,
];

export const WORKER_MODELS: ModelDefinition[] = [];
export const WORKER_MONGO_REPOSITORIES: any[] = [];

export const CLI_MODELS: ModelDefinition[] = [];
export const CLI_MONGO_REPOSITORIES: any[] = [];

export const HWB_MODELS: ModelDefinition[] = [FingerprintModel, DeviceModel];
export const HWB_MONGO_REPOSITORIES: any[] = [FingerprintMRepository, DeviceMRepository];
