import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Cabinet extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true })
  name: string;

  @Prop({ type: MSchema.Types.String, required: false })
  code?: string;

  @Prop({ type: MSchema.Types.Number, required: false })
  numberOfRows?: number;

  @Prop({ type: MSchema.Types.Number, required: false })
  totalBins?: number;

  @Prop({ type: MSchema.Types.String, required: false })
  type?: string;
}

export const CabinetSchema = SchemaFactory.createForClass(Cabinet);

export const CABINET_MODEL_TOKEN = Cabinet.name;

export const CabinetModel: ModelDefinition = {
  name: CABINET_MODEL_TOKEN,
  schema: CabinetSchema,
};
