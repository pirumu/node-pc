import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { schemaOptions } from '../mongo-dal.options';

import { BaseSchema } from './base.schema';

@Schema(schemaOptions)
export class Fingerprint extends BaseSchema {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  userId: string;

  @Prop({ type: MSchema.Types.String, required: true })
  label: string;

  @Prop({ type: MSchema.Types.String, required: true })
  feature: string;

  @Prop({ type: MSchema.Types.Boolean, default: false })
  isSync: boolean;

  @Prop({ type: MSchema.Types.Boolean, required: true })
  objectId: string;
}

export const FingerprintSchema = SchemaFactory.createForClass(Fingerprint);

export const FINGERPRINT_MODEL_TOKEN = Fingerprint.name;

export const FingerprintModel: ModelDefinition = {
  name: FINGERPRINT_MODEL_TOKEN,
  schema: FingerprintSchema,
};
