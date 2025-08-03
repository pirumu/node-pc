import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema, Types } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Item extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true })
  name: string;

  @Prop({ type: MSchema.Types.String, required: true })
  partNo: string;

  @Prop({ type: MSchema.Types.String, required: true })
  materialNo: string;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'ItemType', required: true })
  itemTypeId: Types.ObjectId;

  @Prop({ type: MSchema.Types.String, required: true })
  type: string;

  @Prop({ type: MSchema.Types.String, required: false })
  image?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  description?: string;
}

export const ItemSchema = SchemaFactory.createForClass(Item);

export const ITEM_MODEL_TOKEN = Item.name;

export const ItemModel: ModelDefinition = {
  name: ITEM_MODEL_TOKEN,
  schema: ItemSchema,
};
