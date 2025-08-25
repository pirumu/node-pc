import { Prop, Schema } from '@nestjs/mongoose';
import { Schema as MSchema, Types } from 'mongoose';

@Schema()
export class BaseSchema {
  _id: Types.ObjectId;

  id: string;

  @Prop({ type: MSchema.Types.Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: MSchema.Types.Date, default: Date.now })
  updatedAt: Date;

  @Prop({ type: MSchema.Types.Boolean, default: false })
  deleted: boolean;

  @Prop({ type: MSchema.Types.Date, default: null })
  deletedAt?: Date;
}
