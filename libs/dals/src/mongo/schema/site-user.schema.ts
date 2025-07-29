import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class SiteUser extends BaseSchema {
  @Prop({ type: MSchema.Types.ObjectId, ref: 'Site', required: true })
  siteId: MSchema.Types.ObjectId;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MSchema.Types.ObjectId;
}

export const SiteUserSchema = SchemaFactory.createForClass(SiteUser);

// Create compound index to replicate composite primary key behavior
SiteUserSchema.index({ siteId: 1, userId: 1 }, { unique: true });

export const SITE_USER_MODEL_TOKEN = SiteUser.name;

export const SiteUserModel: ModelDefinition = {
  name: SITE_USER_MODEL_TOKEN,
  schema: SiteUserSchema,
};
