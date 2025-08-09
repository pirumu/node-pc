import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema, Types } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions, subSchemaOptions } from './default.options';

@Schema(subSchemaOptions)
export class Location {
  @Prop({
    type: {
      id: { type: MSchema.Types.String, required: true },
      name: { type: MSchema.Types.String, required: false },
      row: { type: MSchema.Types.Number, required: false },
    },
    required: true,
  })
  bin: {
    id: string;
    name: string;
    row: number;
  };

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  requestQty: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  preQty: number;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  quantity: number;

  @Prop({ type: MSchema.Types.Mixed, required: false })
  cabinet: any;
}

const LocationSchema = SchemaFactory.createForClass(Location);

@Schema(subSchemaOptions)
export class WorkingOrder {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  woId: string;

  @Prop({ type: MSchema.Types.String, required: true })
  wo: string;

  @Prop({ type: MSchema.Types.ObjectId, required: true })
  areaId: string;

  @Prop({ type: MSchema.Types.String, required: true })
  area: string;

  @Prop({ type: MSchema.Types.String, required: true })
  vehicleId: string;

  @Prop({ type: MSchema.Types.String, required: true })
  platform: string;

  @Prop({ type: MSchema.Types.Number, required: true })
  torq: number;
}

@Schema(schemaOptions)
export class ReturnItem extends BaseSchema {
  @Prop({ type: MSchema.Types.ObjectId, ref: 'Item', required: true })
  itemId: Types.ObjectId;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'Bin', required: false })
  binId: Types.ObjectId;

  @Prop({ type: MSchema.Types.Number, required: true })
  quantity: number;

  @Prop({
    type: [WorkingOrder],
    required: false,
    default: [],
  })
  workingOrders: WorkingOrder[];

  @Prop({
    type: [LocationSchema],
    required: false,
    default: [],
  })
  locations: Array<Location>;
}

export const ReturnItemSchema = SchemaFactory.createForClass(ReturnItem);

export const RETURN_ITEM_MODEL_TOKEN = ReturnItem.name;

export const ReturnItemModel: ModelDefinition = {
  name: RETURN_ITEM_MODEL_TOKEN,
  schema: ReturnItemSchema,
};
