import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Port extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true })
  name: string;

  @Prop({ type: MSchema.Types.String, required: true })
  path: string;

  @Prop({ type: MSchema.Types.Number, required: false })
  heartbeat?: number;

  @Prop({ type: MSchema.Types.String, required: true })
  status: string;
}

export const PortSchema = SchemaFactory.createForClass(Port);

export const PORT_MODEL_TOKEN = Port.name;

export const PortModel: ModelDefinition = {
  name: PORT_MODEL_TOKEN,
  schema: PortSchema,
};
