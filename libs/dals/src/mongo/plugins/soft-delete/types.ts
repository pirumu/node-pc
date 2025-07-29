import { Aggregate, Model, Query, Schema, Types } from 'mongoose';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type Func = Function;

export type SoftDeleteOptions = {
  overrideMethods?: 'all' | boolean | string[];
  deletedAt?: boolean;
  deletedBy?: boolean;
  deletedByType?: Schema.Types.ObjectId | string | number;
  use$neOperator?: boolean;
  indexFields?: 'all' | boolean | string[];
  validateBeforeDelete?: boolean;
  validateBeforeRestore?: boolean;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface SoftDeleteDocument {
  _id?: Types.ObjectId;
  id?: string;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Schema.Types.ObjectId | string | number;
  delete?: (deletedBy?: any) => Promise<SoftDeleteDocument>;
  restore?: () => Promise<SoftDeleteDocument>;
}

export type IndexFields = {
  deleted: boolean;
  deletedAt: boolean;
  deletedBy: boolean;
};

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface SoftDeleteModel<T extends SoftDeleteDocument> extends Model<T> {
  count(conditions?: any): Query<number, T>;
  countDocuments(conditions?: any): Query<number, T>;
  find(conditions?: any, projection?: any, options?: any): Query<T[], T>;
  findOne(conditions?: any, projection?: any, options?: any): Query<T | null, T>;
  findOneAndUpdate(conditions?: any, update?: any, options?: any): Query<T | null, T>;
  update(conditions?: any, update?: any, options?: any): Query<any, T>;
  updateOne(conditions?: any, update?: any, options?: any): Query<any, T>;
  updateMany(conditions?: any, update?: any, options?: any): Query<any, T>;
  aggregate(pipeline?: any[], options?: any): Aggregate<any[]>;

  // Deleted methods (only deleted documents)
  countDeleted(conditions?: any): Query<number, T>;
  countDocumentsDeleted(conditions?: any): Query<number, T>;
  findDeleted(conditions?: any, projection?: any, options?: any): Query<T[], T>;
  findOneDeleted(conditions?: any, projection?: any, options?: any): Query<T | null, T>;
  findOneAndUpdateDeleted(conditions?: any, update?: any, options?: any): Query<T | null, T>;
  updateDeleted(conditions?: any, update?: any, options?: any): Query<any, T>;
  updateOneDeleted(conditions?: any, update?: any, options?: any): Query<any, T>;
  updateManyDeleted(conditions?: any, update?: any, options?: any): Query<any, T>;
  aggregateDeleted(pipeline?: any[], options?: any): Aggregate<any[]>;

  // WithDeleted methods (all documents)
  countWithDeleted(conditions?: any): Query<number, T>;
  countDocumentsWithDeleted(conditions?: any): Query<number, T>;
  findWithDeleted(conditions?: any, projection?: any, options?: any): Query<T[], T>;
  findOneWithDeleted(conditions?: any, projection?: any, options?: any): Query<T | null, T>;
  findOneAndUpdateWithDeleted(conditions?: any, update?: any, options?: any): Query<T | null, T>;
  updateWithDeleted(conditions?: any, update?: any, options?: any): Query<any, T>;
  updateOneWithDeleted(conditions?: any, update?: any, options?: any): Query<any, T>;
  updateManyWithDeleted(conditions?: any, update?: any, options?: any): Query<any, T>;
  aggregateWithDeleted(pipeline?: any[], options?: any): Aggregate<any[]>;

  // Delete and restore methods
  delete(conditions?: any, deletedBy?: any): Query<any, T>;
  deleteById(id: any, deletedBy?: any): Query<any, T>;
  restore(conditions?: any): Query<any, T>;
}
