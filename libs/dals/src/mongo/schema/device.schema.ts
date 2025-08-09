import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema, Types } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions, subSchemaOptions } from './default.options';

@Schema(subSchemaOptions)
export class DeviceDescription {
  @Prop({ type: MSchema.Types.String, required: false })
  name?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  partNumber?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  materialNo?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  supplierEmail?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  matlGrp?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  criCode?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  jom?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  itemAcct?: string;

  @Prop({ type: MSchema.Types.Number, required: false })
  field1?: number;

  // Bag 1 - Primary bag information
  @Prop({ type: MSchema.Types.String, required: false })
  expiryBag?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  quantityBag?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  bagNoBatch?: string;

  // Bag 2 - Secondary bag information
  @Prop({ type: MSchema.Types.String, required: false })
  expiryBag2?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  quantityBag2?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  bagNoBatch2?: string;

  // Bag 3 - Tertiary bag information
  @Prop({ type: MSchema.Types.String, required: false })
  expiryBag3?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  quantityBag3?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  bagNoBatch3?: string;
}

@Schema(schemaOptions)
export class Device extends BaseSchema {
  @Prop({ type: MSchema.Types.Number, required: true })
  deviceNumId: number;

  @Prop({ type: MSchema.Types.String, required: true })
  status: string;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'Port', required: true })
  portId: Types.ObjectId;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'Bin', required: false })
  binId?: Types.ObjectId;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'Item', required: false })
  itemId?: Types.ObjectId;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  quantity?: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  calcQuantity?: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  damageQuantity?: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  weight?: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  zeroWeight?: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  unitWeight?: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  calcWeight?: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  quantityMinThreshold?: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  quantityCritThreshold?: number;

  @Prop({ type: MSchema.Types.String, required: false, default: 'unknown' })
  macAddress?: string;

  @Prop({ type: MSchema.Types.String, required: false, default: 'unknown' })
  chipId?: string;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  heartbeat?: number;

  @Prop({ type: MSchema.Types.String, required: false })
  setupTimestamp?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  zeroTimestamp?: string;

  @Prop({ type: MSchema.Types.Array, required: false, default: [] })
  weightHistory: string[];

  @Prop({ type: MSchema.Types.Number, required: false })
  count?: number;

  @Prop({ type: MSchema.Types.Number, required: false })
  changeQty?: number;

  @Prop({ type: MSchema.Types.Boolean, required: false, default: false })
  isSync?: boolean;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  retryCount?: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: false })
  isUpdateWeight?: boolean;

  @Prop({ type: MSchema.Types.String, required: false, default: null })
  label: string | null;

  @Prop({ type: DeviceDescription, required: false, default: {} })
  description?: DeviceDescription;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);

DeviceSchema.virtual('port', {
  ref: 'Port',
  localField: 'portId',
  foreignField: '_id',
  justOne: true,
  options: {
    select: 'path',
  },
});

DeviceSchema.virtual('item', {
  ref: 'Item',
  localField: 'itemId',
  foreignField: '_id',
  justOne: true,
});

DeviceSchema.virtual('bin', {
  ref: 'Bin',
  localField: 'binId',
  foreignField: '_id',
  justOne: true,
});

export const DEVICE_MODEL_TOKEN = Device.name;

export const DeviceModel: ModelDefinition = {
  name: DEVICE_MODEL_TOKEN,
  schema: DeviceSchema,
};
