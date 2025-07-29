import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Condition extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true })
  condition: string;

  @Prop({ type: MSchema.Types.String, required: true })
  description: string;
}

export const ConditionSchema = SchemaFactory.createForClass(Condition);

export const CONDITION_MODEL_TOKEN = Condition.name;

export const ConditionModel: ModelDefinition = {
  name: CONDITION_MODEL_TOKEN,
  schema: ConditionSchema,
};
