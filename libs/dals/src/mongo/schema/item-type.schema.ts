import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class ItemType extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true })
  type: string;

  @Prop({ type: MSchema.Types.String, default: '' })
  description: string;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  isIssue: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  isReturn: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  isReplenish: boolean;
}

export const ItemTypeSchema = SchemaFactory.createForClass(ItemType);

export const ITEM_TYPE_MODEL_TOKEN = ItemType.name;

export const ItemTypeModel: ModelDefinition = {
  name: ITEM_TYPE_MODEL_TOKEN,
  schema: ItemTypeSchema,
};
