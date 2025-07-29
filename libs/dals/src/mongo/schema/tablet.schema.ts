import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Tablet extends BaseSchema {
  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  deviceKey: string;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  setting: Record<string, unknown>;
}

export const TabletSchema = SchemaFactory.createForClass(Tablet);

export const TABLET_MODEL_TOKEN = Tablet.name;

export const TabletModel: ModelDefinition = {
  name: TABLET_MODEL_TOKEN,
  schema: TabletSchema,
};
