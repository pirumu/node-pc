import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Card extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true })
  cardNumber: string;

  @Prop({ type: MSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MSchema.Types.ObjectId;

  @Prop({ type: MSchema.Types.String, required: false })
  accessCode?: string;

  @Prop({ type: MSchema.Types.Date, required: false })
  accessCodeExpiresAt?: Date;
}

export const CardSchema = SchemaFactory.createForClass(Card);

export const CARD_MODEL_TOKEN = Card.name;

export const CardModel: ModelDefinition = {
  name: CARD_MODEL_TOKEN,
  schema: CardSchema,
};
