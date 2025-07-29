import { Schema, Model, Query, PipelineStage } from 'mongoose';

import { SoftDeleteDocument, IndexFields, SoftDeleteOptions } from './types';

function parseUpdateArguments(...args: any[]): any[] {
  let conditions: any = {};
  let doc: any;
  let options: any;

  if (args.length === 1) {
    if (typeof args[0] === 'object' && args[0] !== null) {
      // .update(doc) or .update(conditions)
      doc = args[0];
    }
  } else if (args.length === 2) {
    // .update(conditions, doc) or .update(conditions, options)
    conditions = args[0] || {};
    doc = args[1];
  } else if (args.length >= 3) {
    // .update(conditions, doc, options)
    conditions = args[0] || {};
    doc = args[1];
    options = args[2];
  }

  const result: any[] = [];
  if (conditions !== undefined) {
    result.push(conditions);
  }
  if (doc !== undefined) {
    result.push(doc);
  }
  if (options !== undefined) {
    result.push(options);
  }

  return result;
}

function parseIndexFields(options: SoftDeleteOptions): IndexFields {
  const indexFields: IndexFields = {
    deleted: false,
    deletedAt: false,
    deletedBy: false,
  };

  if (!options.indexFields) {
    return indexFields;
  }

  if (typeof options.indexFields === 'string' && options.indexFields === 'all') {
    indexFields.deleted = indexFields.deletedAt = indexFields.deletedBy = true;
  }

  if (typeof options.indexFields === 'boolean' && options.indexFields) {
    indexFields.deleted = indexFields.deletedAt = indexFields.deletedBy = true;
  }

  if (Array.isArray(options.indexFields)) {
    indexFields.deleted = options.indexFields.indexOf('deleted') > -1;
    indexFields.deletedAt = options.indexFields.indexOf('deletedAt') > -1;
    indexFields.deletedBy = options.indexFields.indexOf('deletedBy') > -1;
  }

  return indexFields;
}

function createSchemaObject(typeKey: string, typeValue: any, options: any): any {
  const result: any = { ...options };
  result[typeKey] = typeValue;
  return result;
}

export function mongooseSoftDelete<T extends SoftDeleteDocument>(
  schema: Schema<T> & { options: { typeKey: any } },
  options: SoftDeleteOptions = {},
): void {
  const indexFields = parseIndexFields(options);
  const typeKey = schema.options.typeKey ? schema.options.typeKey : 'type';

  // Determine the main update method
  const mainUpdateMethod = 'updateMany';

  function updateDocumentsByQuery(model: any, conditions: any, updateQuery: any): Query<any, T> {
    return model[mainUpdateMethod](conditions, updateQuery, { multi: true });
  }

  // Add fields to schema
  schema.add({
    deleted: createSchemaObject(typeKey, Boolean, {
      default: false,
      index: indexFields.deleted,
    }),
  } as any);

  if (options.deletedAt === true) {
    schema.add({
      deletedAt: createSchemaObject(typeKey, Date, {
        index: indexFields.deletedAt,
      }),
    } as any);
  }

  if (options.deletedBy === true) {
    schema.add({
      deletedBy: createSchemaObject(typeKey, options.deletedByType || Schema.Types.ObjectId, {
        index: indexFields.deletedBy,
      }),
    } as any);
  }

  const is$neOperator = options.use$neOperator !== undefined ? options.use$neOperator : true;

  // Pre-save middleware
  schema.pre('save', function (next) {
    if (this.deleted === undefined) {
      this.deleted = false;
    }
    next();
  });

  // Override methods if specified
  if (options.overrideMethods) {
    const overrideItems = options.overrideMethods;
    const overridableMethods = [
      'count',
      'countDocuments',
      'find',
      'findOne',
      'findOneAndUpdate',
      'update',
      'updateOne',
      'updateMany',
      'aggregate',
    ];
    let finalList: string[] = [];

    if (typeof overrideItems === 'string' && overrideItems === 'all') {
      finalList = overridableMethods;
    } else if (typeof overrideItems === 'boolean' && overrideItems === true) {
      finalList = overridableMethods;
    } else if (Array.isArray(overrideItems)) {
      finalList = overrideItems.filter((method) => overridableMethods.includes(method));
    }

    // Handle aggregate separately
    if (finalList.includes('aggregate')) {
      schema.pre('aggregate', function () {
        const firstMatch = this.pipeline()[0] as PipelineStage.Match;

        if (firstMatch?.$match?.deleted?.$ne !== false) {
          if (firstMatch?.$match?.showAllDocuments === 'true') {
            const { showAllDocuments, ...replacement } = firstMatch.$match;
            this.pipeline().shift();
            if (Object.keys(replacement).length > 0) {
              this.pipeline().unshift({ $match: replacement });
            }
          } else {
            this.pipeline().unshift({ $match: { deleted: { $ne: true } } });
          }
        }
      });
    }

    finalList.forEach((method) => {
      if (['count', 'countDocuments', 'find', 'findOne'].includes(method)) {
        // Query methods
        (schema.statics as any)[method] = function (...args: any[]) {
          const query = (Model as any)[method].apply(this, args);
          if (!args[2] || args[2].withDeleted !== true) {
            if (is$neOperator) {
              query.where('deleted').ne(true);
            } else {
              query.where({ deleted: false });
            }
          }
          return query;
        };

        (schema.statics as any)[method + 'Deleted'] = function (...args: any[]) {
          if (is$neOperator) {
            return (Model as any)[method].apply(this, args).where('deleted').ne(false);
          } else {
            return (Model as any)[method].apply(this, args).where({ deleted: true });
          }
        };

        (schema.statics as any)[method + 'WithDeleted'] = function (...args: any[]) {
          return (Model as any)[method].apply(this, args);
        };
      } else {
        if (method === 'aggregate') {
          (schema.statics as any)[method + 'Deleted'] = function (...args: any[]) {
            const newArgs = [...args];
            const match = { $match: { deleted: { $ne: false } } };
            if (args.length && args[0]) {
              newArgs[0].unshift(match);
            } else {
              newArgs.push([match]);
            }
            return (Model as any)[method].apply(this, newArgs);
          };

          (schema.statics as any)[method + 'WithDeleted'] = function (...args: any[]) {
            const newArgs = [...args];
            const match = { $match: { showAllDocuments: 'true' } };
            if (args.length && args[0]) {
              newArgs[0].unshift(match);
            } else {
              newArgs.push([match]);
            }
            return (Model as any)[method].apply(this, newArgs);
          };
        } else {
          // Update methods
          (schema.statics as any)[method] = function (...args: any[]) {
            const parsedArgs = parseUpdateArguments(...args);

            if (is$neOperator) {
              parsedArgs[0] = { ...parsedArgs[0], deleted: { $ne: true } };
            } else {
              parsedArgs[0] = { ...parsedArgs[0], deleted: false };
            }

            return (Model as any)[method].apply(this, parsedArgs);
          };

          (schema.statics as any)[method + 'Deleted'] = function (...args: any[]) {
            const parsedArgs = parseUpdateArguments(...args);

            if (is$neOperator) {
              parsedArgs[0] = { ...parsedArgs[0], deleted: { $ne: false } };
            } else {
              parsedArgs[0] = { ...parsedArgs[0], deleted: true };
            }

            return (Model as any)[method].apply(this, parsedArgs);
          };

          (schema.statics as any)[method + 'WithDeleted'] = function (...args: any[]) {
            return (Model as any)[method].apply(this, args);
          };
        }
      }
    });
  }

  // Instance methods - Promise only
  schema.methods.delete = async function (deletedBy?: any): Promise<any> {
    this.deleted = true;

    if (schema.path('deletedAt')) {
      this.deletedAt = new Date();
    }

    if (schema.path('deletedBy')) {
      this.deletedBy = deletedBy;
    }

    if (options.validateBeforeDelete === false) {
      return this.save({ validateBeforeSave: false });
    }

    return this.save();
  };

  // Static methods - Promise only
  schema.statics.delete = function (conditions: any = {}, deletedBy?: any): Query<any, T> {
    const doc: any = {
      deleted: true,
    };

    if (schema.path('deletedAt')) {
      doc.deletedAt = new Date();
    }

    if (schema.path('deletedBy')) {
      doc.deletedBy = deletedBy;
    }

    return updateDocumentsByQuery(this, conditions, doc);
  };

  schema.statics.deleteById = function (id: any, deletedBy?: any): Query<any, T> {
    if (!id) {
      throw new TypeError('First argument (id) is mandatory and cannot be empty.');
    }

    const conditions = { _id: id };
    return 'delete' in this && typeof this.delete === 'function' ? this.delete(conditions, deletedBy) : (null as any);
  };

  schema.methods.restore = async function (): Promise<any> {
    this.deleted = false;
    this.deletedAt = undefined;
    this.deletedBy = undefined;

    if (options.validateBeforeRestore === false) {
      return this.save({ validateBeforeSave: false });
    }

    return this.save();
  };

  schema.statics.restore = function (conditions: any = {}): Query<any, T> {
    const doc = {
      $unset: {
        deleted: 1,
        deletedAt: 1,
        deletedBy: 1,
      },
    };

    return updateDocumentsByQuery(this, conditions, doc);
  };
}

export default mongooseSoftDelete;
