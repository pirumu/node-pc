import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { schemaOptions } from '../mongo-dal.options';

import { BaseSchema } from './base.schema';

@Schema(schemaOptions)
export class User extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: true, unique: true })
  loginId: string;

  @Prop({ type: MSchema.Types.String, required: true })
  password: string;

  @Prop({ type: MSchema.Types.String, default: null })
  pinCode?: string;

  @Prop({ type: MSchema.Types.String, unique: true, sparse: true })
  employeeId: string;

  @Prop({ type: MSchema.Types.String, unique: true, sparse: true })
  cardNumber: string;

  @Prop({ type: MSchema.Types.String, required: true })
  role: string;

  @Prop({ type: MSchema.Types.String, default: null })
  genealogy: string | null;

  @Prop({ type: MSchema.Types.Mixed, default: {} })
  cloud: Record<string, unknown>;
}

export const UserSchema = SchemaFactory.createForClass(User);

export const USER_MODEL_TOKEN = User.name;

export const UserModel: ModelDefinition = {
  name: USER_MODEL_TOKEN,
  schema: UserSchema,
};
