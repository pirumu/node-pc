import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class BinItem extends BaseSchema {
  @Prop({ type: MSchema.Types.ObjectId, ref: 'Bin', required: true })
  binId: MSchema.Types.ObjectId;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'Item', required: true })
  itemId: MSchema.Types.ObjectId;

  @Prop({ type: MSchema.Types.Number, required: true })
  order: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  min: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  max: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  critical: number;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  hasChargeTime: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  hasCalibrationDue: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  hasExpiryDate: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  hasLoadHydrostaticTestDue: boolean;

  @Prop({ type: MSchema.Types.String, required: false })
  batchNo?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  serialNo?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  chargeTime?: string;

  @Prop({ type: MSchema.Types.Date, required: false })
  calibrationDue?: Date;

  @Prop({ type: MSchema.Types.Date, required: false })
  expiryDate?: Date;

  @Prop({ type: MSchema.Types.Date, required: false })
  loadHydrostaticTestDue?: Date;

  @Prop({ type: MSchema.Types.String, required: false })
  description?: string;
}

export const BinItemSchema = SchemaFactory.createForClass(BinItem);

export const BIN_ITEM_MODEL_TOKEN = BinItem.name;

export const BinItemModel: ModelDefinition = {
  name: BIN_ITEM_MODEL_TOKEN,
  schema: BinItemSchema,
};
