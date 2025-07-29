import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Area extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true })
  name: string;

  @Prop({ type: MSchema.Types.Number, required: true })
  torque: number;
}

export const AreaSchema = SchemaFactory.createForClass(Area);

export const AREA_MODEL_TOKEN = Area.name;

export const AreaModel: ModelDefinition = {
  name: AREA_MODEL_TOKEN,
  schema: AreaSchema,
};
