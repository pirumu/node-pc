import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Log extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true })
  method: string;

  @Prop({ type: MSchema.Types.String, required: true })
  url: string;

  @Prop({ type: MSchema.Types.String, required: true })
  userAgent: string;

  @Prop({ type: MSchema.Types.String, required: true })
  clientIp: string;

  @Prop({ type: MSchema.Types.String, required: true })
  referenceNo: string;

  @Prop({ type: MSchema.Types.String, required: true })
  request: string;

  @Prop({ type: MSchema.Types.String, required: true })
  response: string;

  @Prop({ type: MSchema.Types.String, required: true })
  statusCode: string;
}

export const LogSchema = SchemaFactory.createForClass(Log);

export const LOG_MODEL_TOKEN = Log.name;

export const LogModel: ModelDefinition = {
  name: LOG_MODEL_TOKEN,
  schema: LogSchema,
};
