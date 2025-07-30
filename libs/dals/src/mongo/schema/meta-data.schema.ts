import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

// d
import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class MetaData extends BaseSchema {
  @Prop({ type: MSchema.Types.Date, required: false })
  lastSyncTime?: Date;

  @Prop({ type: MSchema.Types.String, required: false })
  syncVersion?: string;
}

export const MetaDataSchema = SchemaFactory.createForClass(MetaData);

export const META_DATA_MODEL_TOKEN = MetaData.name;

export const MetaDataModel: ModelDefinition = {
  name: META_DATA_MODEL_TOKEN,
  schema: MetaDataSchema,
};
