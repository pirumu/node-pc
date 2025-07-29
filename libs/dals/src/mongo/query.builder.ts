import {
  FilterCondition,
  FilterConditionNested,
  LogicalCondition,
  LogicalConditionNested,
  QueryCondition,
  QueryOperator,
  QueryRequest,
} from '@framework/types';
import { QueryOptions } from 'mongoose';
import { PipelineStage } from 'mongoose';

const OPERATOR_MAP: Record<QueryOperator, string> = {
  [QueryOperator.EQUAL]: '$eq',
  [QueryOperator.NOT_EQUAL]: '$ne',
  [QueryOperator.GREATER_THAN]: '$gt',
  [QueryOperator.GREATER_THAN_OR_EQUAL]: '$gte',
  [QueryOperator.LESS_THAN]: '$lt',
  [QueryOperator.LESS_THAN_OR_EQUAL]: '$lte',
  [QueryOperator.IN]: '$in',
  [QueryOperator.NOT_IN]: '$nin',
  [QueryOperator.EXISTS]: '$exists',
  [QueryOperator.TYPE]: '$type',
  [QueryOperator.ALL]: '$all',
  [QueryOperator.ELEM_MATCH]: '$elemMatch',
  [QueryOperator.SIZE]: '$size',
  [QueryOperator.MOD]: '$mod',
  [QueryOperator.REGEX]: '$regex',
  [QueryOperator.WHERE]: '$where',
  [QueryOperator.AND]: '$and',
  [QueryOperator.OR]: '$or',
  [QueryOperator.NOT]: '$not',
  [QueryOperator.NOR]: '$nor',
  [QueryOperator.NEAR]: '$near',
  [QueryOperator.WITHIN]: '$within',

  [QueryOperator.LIKE]: '$regex',
  [QueryOperator.NOT_LIKE]: '$regex',
  [QueryOperator.STARTS_WITH]: '$regex',
  [QueryOperator.ENDS_WITH]: '$regex',
  [QueryOperator.CONTAINS]: '$regex',
  [QueryOperator.IS_NULL]: '$eq',
  [QueryOperator.IS_NOT_NULL]: '$ne',
  [QueryOperator.DATE_BETWEEN]: '$gte',
};

/**
 * todo: add more function to support query builder.
 */
export class MongoQueryBuilder {
  private static _convertCondition(condition: QueryCondition): Record<string, any> {
    const { field, operator, value, options } = condition;

    switch (operator) {
      case QueryOperator.LIKE:
        return {
          [field]: {
            $regex: this._escapeRegex(value),
            $options: options?.caseSensitive ? '' : 'i',
          },
        };

      case QueryOperator.NOT_LIKE:
        return {
          [field]: {
            $not: {
              $regex: this._escapeRegex(value),
              $options: options?.caseSensitive ? '' : 'i',
            },
          },
        };

      case QueryOperator.STARTS_WITH:
        return {
          [field]: {
            $regex: `^${this._escapeRegex(value)}`,
            $options: options?.caseSensitive ? '' : 'i',
          },
        };

      case QueryOperator.ENDS_WITH:
        return {
          [field]: {
            $regex: `${this._escapeRegex(value)}$`,
            $options: options?.caseSensitive ? '' : 'i',
          },
        };

      case QueryOperator.CONTAINS:
        return {
          [field]: {
            $regex: `.*${this._escapeRegex(value)}.*`,
            $options: options?.caseSensitive ? '' : 'i',
          },
        };

      case QueryOperator.IS_NULL:
        return { [field]: null };

      case QueryOperator.IS_NOT_NULL:
        return { [field]: { $ne: null } };

      case QueryOperator.DATE_BETWEEN:
        if (Array.isArray(value) && value.length === 2) {
          return {
            [field]: {
              $gte: value[0],
              $lte: value[1],
            },
          };
        }
        throw new Error('DATE_BETWEEN requires array with 2 dates');

      default:
        const mongoOperator = OPERATOR_MAP[operator];
        if (!mongoOperator) {
          throw new Error(`Unknown operator: ${operator}`);
        }

        if (operator === QueryOperator.EQUAL && value === null) {
          return { [field]: null };
        }

        return { [field]: { [mongoOperator]: value } };
    }
  }

  private static _convertLogicalCondition(condition: LogicalCondition): Record<string, any> {
    const mongoOperator = OPERATOR_MAP[condition.operator];
    const convertedConditions = condition.conditions.map((cond) =>
      this._isLogicalCondition(cond) ? this._convertLogicalCondition(cond) : this._convertCondition(cond),
    );

    if (condition.operator === QueryOperator.NOT && convertedConditions.length === 1) {
      return { $not: convertedConditions[0] };
    }

    return { [mongoOperator]: convertedConditions };
  }

  private static _isLogicalCondition(condition: FilterCondition): condition is LogicalCondition {
    return 'conditions' in condition;
  }

  private static _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  public static build(conditions: FilterCondition | FilterCondition[]): Record<string, any> {
    if (!conditions || (Array.isArray(conditions) && conditions.length === 0)) {
      return {};
    }

    if (!Array.isArray(conditions)) {
      if (this._isLogicalCondition(conditions)) {
        return this._convertLogicalCondition(conditions);
      }
      return this._convertCondition(conditions);
    }

    if (conditions.length === 1) {
      const condition = conditions[0];
      if (this._isLogicalCondition(condition)) {
        return this._convertLogicalCondition(condition);
      }
      return this._convertCondition(condition);
    }

    const convertedConditions = conditions.map((cond) =>
      this._isLogicalCondition(cond) ? this._convertLogicalCondition(cond) : this._convertCondition(cond),
    );

    return { $and: convertedConditions };
  }
}

export const where = (field: string) => ({
  eq: (value: any): QueryCondition => ({ field, operator: QueryOperator.EQUAL, value }),
  ne: (value: any): QueryCondition => ({ field, operator: QueryOperator.NOT_EQUAL, value }),
  gt: (value: any): QueryCondition => ({ field, operator: QueryOperator.GREATER_THAN, value }),
  gte: (value: any): QueryCondition => ({ field, operator: QueryOperator.GREATER_THAN_OR_EQUAL, value }),
  lt: (value: any): QueryCondition => ({ field, operator: QueryOperator.LESS_THAN, value }),
  lte: (value: any): QueryCondition => ({ field, operator: QueryOperator.LESS_THAN_OR_EQUAL, value }),
  in: (value: any[]): QueryCondition => ({ field, operator: QueryOperator.IN, value }),
  nin: (value: any[]): QueryCondition => ({ field, operator: QueryOperator.NOT_IN, value }),
  like: (value: string, options?: QueryOptions): QueryCondition => ({
    field,
    operator: QueryOperator.LIKE,
    value,
    options: options as any,
  }),
  startsWith: (value: string, options?: QueryOptions): QueryCondition => ({
    field,
    operator: QueryOperator.STARTS_WITH,
    value,
    options: options as any,
  }),
  endsWith: (value: string, options?: QueryOptions): QueryCondition => ({
    field,
    operator: QueryOperator.ENDS_WITH,
    value,
    options: options as any,
  }),
  contains: (value: string, options?: QueryOptions): QueryCondition => ({
    field,
    operator: QueryOperator.CONTAINS,
    value,
    options: options as any,
  }),
  isNull: (): QueryCondition => ({ field, operator: QueryOperator.IS_NULL, value: null }),
  isNotNull: (): QueryCondition => ({ field, operator: QueryOperator.IS_NOT_NULL, value: null }),
  between: (start: any, end: any): QueryCondition => ({ field, operator: QueryOperator.DATE_BETWEEN, value: [start, end] }),
  exists: (value: boolean = true): QueryCondition => ({ field, operator: QueryOperator.EXISTS, value }),
  size: (value: number): QueryCondition => ({ field, operator: QueryOperator.SIZE, value }),
  all: (value: any[]): QueryCondition => ({ field, operator: QueryOperator.ALL, value }),
});

export const and = (...conditions: FilterCondition[]): LogicalCondition => ({
  operator: QueryOperator.AND,
  conditions,
});

export const or = (...conditions: FilterCondition[]): LogicalCondition => ({
  operator: QueryOperator.OR,
  conditions,
});

export const not = (condition: FilterCondition): LogicalCondition => ({
  operator: QueryOperator.NOT,
  conditions: [condition],
});

export const nor = (...conditions: FilterCondition[]): LogicalCondition => ({
  operator: QueryOperator.NOR,
  conditions,
});

export class FilterGroupBuilder {
  public static build(request: QueryRequest): Record<string, any> {
    const conditions: FilterCondition[] = [];

    if (request.filters && request.filters.length > 0) {
      conditions.push(...request.filters);
    }

    if (request.filterGroups) {
      request.filterGroups.forEach((group) => {
        if (group.conditions.length === 0) {
          return;
        }

        if (group.conditions.length === 1) {
          conditions.push(group.conditions[0]);
        } else {
          const groupCondition = group.logic === 'OR' ? or(...group.conditions) : and(...group.conditions);
          conditions.push(groupCondition);
        }
      });
    }

    return MongoQueryBuilder.build(conditions.length > 1 ? and(...conditions) : conditions[0]);
  }
}

export class NestedFilterBuilder {
  public static build(condition: FilterConditionNested): Record<string, any> {
    if (condition.type === 'query') {
      return MongoQueryBuilder.build(condition as QueryCondition);
    }

    const logicalCond = condition as LogicalConditionNested;
    const convertedConditions = logicalCond.conditions.map((c) => this.build(c));

    switch (logicalCond.logic) {
      case 'AND':
        return { $and: convertedConditions };
      case 'OR':
        return { $or: convertedConditions };
      case 'NOT':
        return { $not: convertedConditions[0] };
      case 'NOR':
        return { $nor: convertedConditions };
    }
  }
}

export type PipelineStageBuilder = PipelineStage;
