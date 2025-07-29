import { SchemaOptions } from '@nestjs/mongoose';

export const schemaOptions: SchemaOptions = {
  id: true,
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
  toObject: { virtuals: true },
  versionKey: false,
  minimize: false,
  strict: false,
};
