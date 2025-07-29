import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema } from 'mongoose';

import { BaseSchema } from './base.schema';
import { schemaOptions } from './default.options';

@Schema(schemaOptions)
export class Transaction extends BaseSchema {
  @Prop({ type: MSchema.Types.String, required: false })
  name?: string;

  @Prop({ type: MSchema.Types.String, required: false })
  type?: string;

  @Prop({ type: MSchema.Types.Number, required: false })
  requestQty?: number;

  @Prop({ type: MSchema.Types.Number, required: false })
  clusterId?: number;

  @Prop({
    type: {
      id: { type: MSchema.Types.String, required: true },
      loginId: { type: MSchema.Types.String, required: true },
      role: { type: MSchema.Types.String, required: true },
    },
    required: false,
  })
  user?: {
    id: string;
    loginId: string;
    role: string;
  };

  @Prop({
    type: [
      {
        cabinet: {
          id: { type: MSchema.Types.Number, required: true },
          name: { type: MSchema.Types.String, required: true },
        },
        bin: {
          id: { type: MSchema.Types.Number, required: true },
          name: { type: MSchema.Types.String, required: true },
          row: { type: MSchema.Types.Number, required: false },
        },
        spares: [
          {
            id: { type: MSchema.Types.Number, required: true },
            type: { type: MSchema.Types.String, required: true },
            changed_qty: { type: MSchema.Types.Number, required: true },
            listWO: { type: MSchema.Types.Array, required: false },
          },
        ],
      },
    ],
    required: false,
  })
  locations?: Array<{
    cabinet: {
      id: number;
      name: string;
    };
    bin: {
      id: number;
      name: string;
      row?: number;
    };
    spares: Array<{
      id: number;
      type: string;
      changedQty: number;
      listWO?: any[];
    }>;
  }>;

  @Prop({
    type: [
      {
        cabinet: {
          id: { type: MSchema.Types.Number, required: true },
          name: { type: MSchema.Types.String, required: true },
        },
        bin: {
          id: { type: MSchema.Types.Number, required: true },
          name: { type: MSchema.Types.String, required: true },
          row: { type: MSchema.Types.Number, required: false },
        },
        spares: [
          {
            id: { type: MSchema.Types.Number, required: true },
            type: { type: MSchema.Types.String, required: true },
            changedQty: { type: MSchema.Types.Number, required: true },
            listWO: { type: MSchema.Types.Mixed, required: false },
          },
        ],
      },
    ],
    required: false,
  })
  locationsTemp?: Array<{
    cabinet: {
      id: number;
      name: string;
    };
    bin: {
      id: number;
      name: string;
      row?: number;
    };
    spares: Array<{
      id: number;
      type: string;
      changedQty: number;
      listWO?: any;
    }>;
  }>;

  @Prop({ type: MSchema.Types.String, required: false })
  status?: string;

  @Prop({ type: MSchema.Types.Number, required: false })
  isSync?: boolean;

  @Prop({ type: MSchema.Types.Number, required: false })
  retryCount?: number;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

export const TRANSACTION_MODEL_TOKEN = Transaction.name;

export const TransactionModel: ModelDefinition = {
  name: TRANSACTION_MODEL_TOKEN,
  schema: TransactionSchema,
};
