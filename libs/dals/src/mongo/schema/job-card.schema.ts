import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class JobCard extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true })
  wo: string;

  @Prop({ type: MSchema.Types.String, required: true })
  platform: string;

  @Prop({ type: MSchema.Types.String, required: true })
  vehicleId: string;

  @Prop({ type: MSchema.Types.Number, required: true })
  status: number;

  @Prop({ type: MSchema.Types.String, required: false })
  cardNumber: string;

  @Prop({ type: MSchema.Types.Number, required: true })
  vehicleNum: number;

  @Prop({ type: MSchema.Types.String, required: true })
  vehicleType: string;

  @Prop({ type: MSchema.Types.Boolean, required: false, default: false })
  isSync: boolean;

  @Prop({ type: MSchema.Types.Number, required: false, default: 0 })
  retryCount: number;
}

export const JobCardSchema = SchemaFactory.createForClass(JobCard);

export const JOB_CARD_MODEL_TOKEN = JobCard.name;

export const JobCardModel: ModelDefinition = {
  name: JOB_CARD_MODEL_TOKEN,
  schema: JobCardSchema,
};
