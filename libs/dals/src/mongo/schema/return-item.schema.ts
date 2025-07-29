import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class ReturnItem extends BaseSchema {
  @Prop({ type: MSchema.Types.ObjectId, ref: 'Item', required: true })
  itemId: string;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'Bin', required: false })
  binId: string;

  @Prop({ type: MSchema.Types.Number, required: true })
  quantity: number;

  @Prop({
    type: [
      {
        woId: { type: MSchema.Types.ObjectId, required: true },
        wo: { type: MSchema.Types.String, required: true },
        vehicleId: { type: MSchema.Types.String, required: true },
        platform: { type: MSchema.Types.String, required: true },
        areaId: { type: MSchema.Types.String, required: true },
        torq: { type: MSchema.Types.Number, required: true },
        area: { type: MSchema.Types.String, required: true },
      },
    ],
    required: false,
    default: [],
  })
  listWo?: Array<{
    woId: string;
    wo: string;
    vehicleId: string;
    platform: string;
    areaId: string;
    torq: number;
    area: string;
  }>;

  @Prop({
    type: [
      {
        quantity: { type: MSchema.Types.Number, required: true },
        bin: {
          id: { type: MSchema.Types.ObjectId, required: true },
        },
        requestQty: { type: MSchema.Types.Number, required: false },
        preQty: { type: MSchema.Types.Number, required: false },
      },
    ],
    required: false,
    default: [],
  })
  locations: Array<{
    bin: {
      id: string;
      name: string;
      row: number;
    };
    requestQty: number;
    preQty: number;
    quantity: number;
  }>;
}

export const ReturnItemSchema = SchemaFactory.createForClass(ReturnItem);

export const RETURN_ITEM_MODEL_TOKEN = ReturnItem.name;

export const ReturnItemModel: ModelDefinition = {
  name: RETURN_ITEM_MODEL_TOKEN,
  schema: ReturnItemSchema,
};
