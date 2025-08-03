import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema, Types } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Bin extends BaseSchema {
  @Prop({ type: MSchema.Types.ObjectId, ref: 'Cabinet', required: true })
  cabinetId: Types.ObjectId;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'User', required: false })
  processBy?: Types.ObjectId;

  @Prop({ type: MSchema.Types.String, required: true })
  name: string;

  @Prop({ type: MSchema.Types.Number, required: true })
  cuId: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  lockId: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  countFailed: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  row: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  min: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  max: number;

  @Prop({ type: MSchema.Types.Number, required: true })
  critical: number;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  isProcessing: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  isFailed: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  isLocked: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  isRfid: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  isDrawer: boolean;

  @Prop({ type: MSchema.Types.String, required: true })
  drawerName: string;

  @Prop({ type: MSchema.Types.String, required: true })
  status: string;

  @Prop({ type: MSchema.Types.String, required: false })
  description?: string;

  @Prop({ type: MSchema.Types.Date, required: false, default: new Date() })
  processTime?: Date;

  @Prop({ type: MSchema.Types.Boolean, required: false, default: false })
  isDamage?: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: false, default: false })
  isSync?: boolean;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  retryCount?: number;

  @Prop({ type: MSchema.Types.Boolean, required: false, default: false })
  isCalibrated?: boolean;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  newMax?: number;
}

export const BinSchema = SchemaFactory.createForClass(Bin);

export const BIN_MODEL_TOKEN = Bin.name;

export const BinModel: ModelDefinition = {
  name: BIN_MODEL_TOKEN,
  schema: BinSchema,
};
