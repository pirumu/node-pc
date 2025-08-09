import { PROCESS_ITEM_TYPE } from '@common/constants';
import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions, subSchemaOptions } from './default.options';

@Schema(subSchemaOptions)
export class UserInfo {
  @Prop({ type: MSchema.Types.String, required: true })
  id: string;

  @Prop({ type: MSchema.Types.String, required: true })
  cloudId: string;

  @Prop({ type: MSchema.Types.String, required: true })
  loginId: string;

  @Prop({ type: MSchema.Types.String, required: true })
  role: string;
}

@Schema(subSchemaOptions)
export class CabinetInfo {
  @Prop({ type: MSchema.Types.String, required: true })
  id: string;

  @Prop({ type: MSchema.Types.String, required: true })
  name: string;
}

@Schema(subSchemaOptions)
export class BinInfo {
  @Prop({ type: MSchema.Types.String, required: true })
  id: string;

  @Prop({ type: MSchema.Types.String, required: true })
  name: string;

  @Prop({ type: MSchema.Types.Number, required: false })
  row: number;

  @Prop({ type: MSchema.Types.Number, required: false })
  cuId: number;

  @Prop({ type: MSchema.Types.Number, required: false })
  lockId: number;
}

@Schema(subSchemaOptions)
export class WorkingOrderInfo {
  @Prop({ type: MSchema.Types.String, required: true })
  woId: string;
  @Prop({ type: MSchema.Types.String, required: true })
  wo: string;
  @Prop({ type: MSchema.Types.String, required: true })
  vehicleId: string;
  @Prop({ type: MSchema.Types.String, required: true })
  platform: string;
  @Prop({ type: MSchema.Types.String, required: true })
  areaId: string;
  @Prop({ type: MSchema.Types.Number, required: true })
  torq: number;
  @Prop({ type: MSchema.Types.String, required: true })
  area: string;
}

@Schema(subSchemaOptions)
export class SpareInfo {
  @Prop({ type: MSchema.Types.String, required: true })
  id: string;

  @Prop({ type: MSchema.Types.String, required: true })
  name: string;

  @Prop({ type: MSchema.Types.String, required: true })
  partNo: string;

  @Prop({ type: MSchema.Types.String, required: true })
  materialNo: string;

  @Prop({ type: MSchema.Types.String, required: true })
  itemTypeId: string;

  @Prop({ type: MSchema.Types.String, required: true })
  type: string;

  @Prop({ type: MSchema.Types.String, required: true })
  conditionName: string;

  @Prop({ type: MSchema.Types.Number, required: true })
  quantity: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  previousQty: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  currentQty: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  changedQty: number;

  @Prop({ type: [WorkingOrderInfo], required: true })
  workingOrders: WorkingOrderInfo[];
}

@Schema(subSchemaOptions)
export class LocationInfo {
  @Prop({ type: CabinetInfo, required: true })
  cabinet: CabinetInfo;

  @Prop({ type: BinInfo, required: true })
  bin: BinInfo;

  @Prop({ type: [SpareInfo], required: true })
  spares: SpareInfo[];
}

@Schema(schemaOptions)
export class Transaction extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: false })
  name: string;

  @Prop({ type: MSchema.Types.String, required: false })
  type: PROCESS_ITEM_TYPE;

  @Prop({ type: MSchema.Types.Number, required: false })
  requestQty: number;

  @Prop({ type: MSchema.Types.String, required: false })
  clusterId: string;

  @Prop({ type: UserInfo, required: false })
  user: UserInfo;

  @Prop({ type: [LocationInfo], required: false })
  locations: LocationInfo[];

  @Prop({ type: [LocationInfo], required: false })
  locationsTemp: LocationInfo[];

  @Prop({ type: MSchema.Types.String, required: false })
  status: string;

  @Prop({ type: MSchema.Types.Boolean, required: false, default: false })
  isSync: boolean;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  retryCount: number;

  @Prop({ type: MSchema.Types.String, required: false, default: null })
  error: string | null;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

export const TRANSACTION_MODEL_TOKEN = Transaction.name;

export const TransactionModel: ModelDefinition = {
  name: TRANSACTION_MODEL_TOKEN,
  schema: TransactionSchema,
};
