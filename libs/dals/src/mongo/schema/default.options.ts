export const schemaOptions = {
  id: true,
  _id: true,
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
  toObject: { virtuals: true },
  versionKey: false,
};

export const subSchemaOptions = {
  _id: false,
  timestamps: false,
  toJSON: {
    virtuals: true,
  },
  toObject: { virtuals: true },
  versionKey: false,
};
