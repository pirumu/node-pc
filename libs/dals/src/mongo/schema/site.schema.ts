import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Site extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true })
  name: string;

  @Prop({ type: MSchema.Types.String, required: false })
  email?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  mobile?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  reportSchedule?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  reportTiming?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  reportFormat?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  lowStockSchedule?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  lowStockTiming?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  typeNotification?: string;
}

export const SiteSchema = SchemaFactory.createForClass(Site);

export const SITE_MODEL_TOKEN = Site.name;

export const SiteModel: ModelDefinition = {
  name: SITE_MODEL_TOKEN,
  schema: SiteSchema,
};
