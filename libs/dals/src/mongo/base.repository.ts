import {
  QueryOptions,
  FilterQuery,
  UpdateQuery,
  UpdateWithAggregationPipeline,
  PipelineStage,
  AggregateOptions,
  Types,
  HydratedDocument,
  ClientSession,
  DeleteResult,
  AnyBulkWriteOperation,
} from 'mongoose';

import { SoftDeleteDocument, SoftDeleteModel } from './plugins/soft-delete';

export type LeanDocument<T> = T & {
  _id: Types.ObjectId;
  ['__v']?: number;
};

type RepositoryOptions<M> = QueryOptions<M> & {
  lean?: boolean;
  select?: string | string[] | Record<keyof M, 0 | 1>;
  populate?: any;
};

export abstract class BaseRepository<M extends SoftDeleteDocument> {
  protected model: SoftDeleteModel<M>;

  protected constructor(model: SoftDeleteModel<M>) {
    this.model = model;
  }

  public getModel(): SoftDeleteModel<M> {
    return this.model;
  }

  private _applyQueryOptions<Q = any>(query: Q, options: RepositoryOptions<M>): Q {
    if (options.select) {
      (query as any).select(options.select);
    }
    if (options.populate) {
      (query as any).populate(options.populate);
    }
    if (options.lean !== false) {
      (query as any).lean();
    }
    (query as any).setOptions(options);
    return query;
  }

  public async findFirst(filter: FilterQuery<M>, options?: RepositoryOptions<M> & { lean: false }): Promise<HydratedDocument<M> | null>;
  public async findFirst(filter: FilterQuery<M>, options?: RepositoryOptions<M> & { lean?: true }): Promise<LeanDocument<M> | null>;
  public async findFirst(
    filter: FilterQuery<M>,
    options: RepositoryOptions<M> = { lean: true },
  ): Promise<HydratedDocument<M> | LeanDocument<M> | null> {
    const query = this.model.findOne(filter);
    this._applyQueryOptions(query, options);
    return (await query.exec()) as unknown as HydratedDocument<M> | LeanDocument<M> | null;
  }

  public async exists(filter: FilterQuery<M>): Promise<boolean> {
    const result = await this.model.exists(filter).exec();
    return result !== null;
  }

  public async findMany(filter: FilterQuery<M>, options?: RepositoryOptions<M> & { lean: false }): Promise<HydratedDocument<M>[]>;
  public async findMany(filter: FilterQuery<M>, options?: RepositoryOptions<M> & { lean?: true }): Promise<LeanDocument<M>[]>;
  public async findMany(
    filter: FilterQuery<M>,
    options: RepositoryOptions<M> = { lean: true },
  ): Promise<HydratedDocument<M>[] | LeanDocument<M>[]> {
    const query = this.model.find(filter);
    this._applyQueryOptions(query, options);
    return (await query.exec()) as unknown as HydratedDocument<M>[] | LeanDocument<M>[];
  }

  public async aggregate<T = unknown>(pipeline?: PipelineStage[], options?: AggregateOptions): Promise<T[]> {
    return this.model.aggregate(pipeline, options).exec();
  }

  public async create(record: Partial<M>): Promise<HydratedDocument<M>> {
    const doc = await this.model.create(record);
    return doc as HydratedDocument<M>;
  }

  public async upsert(
    filter: FilterQuery<M>,
    update: UpdateQuery<M>,
    options?: RepositoryOptions<M> & { lean: false },
  ): Promise<HydratedDocument<M> | null>;
  public async upsert(
    filter: FilterQuery<M>,
    update: UpdateQuery<M>,
    options?: RepositoryOptions<M> & { lean?: true },
  ): Promise<LeanDocument<M> | null>;
  public async upsert(
    filter: FilterQuery<M>,
    update: UpdateQuery<M>,
    options: RepositoryOptions<M> = { lean: true },
  ): Promise<HydratedDocument<M> | LeanDocument<M> | null> {
    const query = this.model.findOneAndUpdate(filter, update, {
      ...options,
      upsert: true,
      new: true,
    });
    this._applyQueryOptions(query, options);
    return (await query.exec()) as unknown as HydratedDocument<M> | LeanDocument<M> | null;
  }

  public async bulkCreate(records: Array<Partial<M>>): Promise<HydratedDocument<M>[]> {
    const docs = await this.model.insertMany(records);
    return docs as HydratedDocument<M>[];
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async updateFirst(filter: FilterQuery<M>, update: UpdateQuery<M> | UpdateWithAggregationPipeline, options: QueryOptions<M>) {
    return this.model.updateOne(filter, update, options).exec();
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async updateMany(
    filter: FilterQuery<M>,
    update: UpdateQuery<M> | UpdateWithAggregationPipeline,
    options?: QueryOptions<M> & { upsert?: boolean },
  ) {
    return this.model.updateMany(filter, update, options).exec();
  }

  public async bulkWrite(records: Array<AnyBulkWriteOperation<M>>): Promise<{
    modifiedCount: number;
    get ok(): number;
    getUpsertedIdAt(index: number): any | undefined;
    getRawResponse(): any;
    hasWriteErrors(): boolean;
    getWriteErrorCount(): number;
    getWriteErrorAt(index: number): any | undefined;
    getWriteErrors(): any[];
    getWriteConcernError(): any | undefined;
    toString(): string;
    isOk(): boolean;
  }> {
    return this.model.bulkWrite(records as any);
  }
  public async count(filter: FilterQuery<M>): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  public async removeFirst(filter: FilterQuery<M>): Promise<DeleteResult> {
    return this.model.deleteOne(filter).exec();
  }

  public async removeMany(filter: FilterQuery<M>): Promise<DeleteResult> {
    return this.model.deleteMany(filter).exec();
  }

  public async transaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.model.db.startSession();
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  public async findById(id: string | Types.ObjectId, options?: RepositoryOptions<M> & { lean: false }): Promise<HydratedDocument<M> | null>;
  public async findById(id: string | Types.ObjectId, options?: RepositoryOptions<M> & { lean?: true }): Promise<LeanDocument<M> | null>;
  public async findById(
    id: string | Types.ObjectId,
    options: RepositoryOptions<M> = { lean: true },
  ): Promise<HydratedDocument<M> | LeanDocument<M> | null> {
    const query = this.model.findById(id);
    this._applyQueryOptions(query, options);
    return query.exec();
  }

  public async findByIdAndUpdate(
    id: string | Types.ObjectId,
    update: UpdateQuery<M>,
    options?: RepositoryOptions<M> & { lean: false },
  ): Promise<HydratedDocument<M> | null>;
  public async findByIdAndUpdate(
    id: string | Types.ObjectId,
    update: UpdateQuery<M>,
    options?: RepositoryOptions<M> & { lean?: true },
  ): Promise<LeanDocument<M> | null>;
  public async findByIdAndUpdate(
    id: string | Types.ObjectId,
    update: UpdateQuery<M>,
    options: RepositoryOptions<M> = { lean: true },
  ): Promise<HydratedDocument<M> | LeanDocument<M> | null> {
    const query = this.model.findByIdAndUpdate(id, update, {
      ...options,
      new: true,
    });
    this._applyQueryOptions(query, options);
    return query.exec();
  }

  public async findByIdAndDelete(
    id: string | Types.ObjectId,
    options: RepositoryOptions<M> = { lean: true },
  ): Promise<HydratedDocument<M> | LeanDocument<M> | null> {
    const query = this.model.findByIdAndDelete(id);
    this._applyQueryOptions(query, options);
    return query.exec();
  }

  public async paginate(
    filter: FilterQuery<M>,
    options: {
      page?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
      select?: string | string[] | Record<keyof M, 0 | 1>;
      populate?: any;
      lean?: boolean;
    } = {},
  ): Promise<{
    docs: HydratedDocument<M>[] | LeanDocument<M>[];
    totalDocs: number;
    limit: number;
    totalPages: number;
    page: number;
    pagingCounter: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPage: number | null;
    nextPage: number | null;
  }> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { page = 1, limit = 10, sort = { _id: -1 }, select, populate, lean = true } = options;

    const skip = ((page === 0 ? 1 : page) - 1) * limit;

    const query = this.model.find(filter).sort(sort).limit(limit).skip(skip);

    this._applyQueryOptions(query, { select, populate, lean });

    const [docs, totalDocs] = await Promise.all([query.exec(), this.model.countDocuments(filter).exec()]);

    const totalPages = Math.ceil(totalDocs / limit);
    const hasPrevPage = page > 1;
    const hasNextPage = page < totalPages;

    return {
      docs: docs as unknown as HydratedDocument<M>[] | LeanDocument<M>[],
      totalDocs,
      limit,
      totalPages,
      page,
      pagingCounter: skip + 1,
      hasPrevPage,
      hasNextPage,
      prevPage: hasPrevPage ? page - 1 : null,
      nextPage: hasNextPage ? page + 1 : null,
    };
  }

  public async findWithFields(
    filter: FilterQuery<M>,
    fields: (keyof M)[],
    options?: Omit<RepositoryOptions<M>, 'select'>,
  ): Promise<LeanDocument<M>[]> {
    const selectObj = fields.reduce(
      (acc, field) => {
        acc[field as string] = 1;
        return acc;
      },
      {} as Record<string, 1>,
    );

    return this.findMany(filter, {
      ...options,
      select: selectObj as any,
      lean: true,
    });
  }

  public async findOneWithFields(
    filter: FilterQuery<M>,
    fields: (keyof M)[],
    options?: Omit<RepositoryOptions<M>, 'select'>,
  ): Promise<LeanDocument<M> | null> {
    const selectObj = fields.reduce(
      (acc, field) => {
        acc[field as string] = 1;
        return acc;
      },
      {} as Record<string, 1>,
    );

    return this.findFirst(filter, {
      ...options,
      select: selectObj as any,
      lean: true,
    });
  }

  public async findWithExclude(
    filter: FilterQuery<M>,
    excludeFields: (keyof M)[],
    options?: Omit<RepositoryOptions<M>, 'select'>,
  ): Promise<LeanDocument<M>[]> {
    const selectObj = excludeFields.reduce(
      (acc, field) => {
        acc[field as string] = 0;
        return acc;
      },
      {} as Record<string, 0>,
    );

    return this.findMany(filter, {
      ...options,
      select: selectObj as any,
      lean: true,
    });
  }
}
