export enum QueryOperator {
  EQUAL = 'eq',
  NOT_EQUAL = 'ne',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'nin',

  LIKE = 'like',
  NOT_LIKE = 'not_like',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  CONTAINS = 'contains',

  AND = 'and',
  OR = 'or',
  NOT = 'not',
  NOR = 'nor',

  EXISTS = 'exists',
  TYPE = 'type',

  ALL = 'all',
  ELEM_MATCH = 'elem_match',
  SIZE = 'size',

  REGEX = 'regex',
  MOD = 'mod',
  WHERE = 'where',

  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',

  DATE_BETWEEN = 'date_between',

  NEAR = 'near',
  WITHIN = 'within',
}

export type QueryCondition = {
  field: string;
  operator: QueryOperator;
  value: any;
  options?: QueryOptions;
};

export type QueryOptions = {
  caseSensitive?: boolean;
  escape?: boolean;
};

export type LogicalCondition = {
  operator: QueryOperator.AND | QueryOperator.OR | QueryOperator.NOT | QueryOperator.NOR;
  conditions: (QueryCondition | LogicalCondition)[];
};

export type FilterCondition = QueryCondition | LogicalCondition;

export type FilterGroup = {
  logic: 'AND' | 'OR';
  conditions: QueryCondition[];
};

export type QueryRequest = {
  filters?: QueryCondition[];
  filterGroups?: FilterGroup[];
};

export type BaseCondition = {
  type: 'query' | 'logical';
};

export type QueryConditionNested = BaseCondition & {
  type: 'query';
  field: string;
  operator: QueryOperator;
  value: any;
  options?: QueryOptions;
};

export type LogicalConditionNested = BaseCondition & {
  type: 'logical';
  logic: 'AND' | 'OR' | 'NOT' | 'NOR';
  conditions: (QueryConditionNested | LogicalConditionNested)[];
};

export type FilterConditionNested = QueryConditionNested | LogicalConditionNested;

export type PaginationOptions = {
  page: number;
  limit: number;
};

export type SortOptions = Record<string, 'asc' | 'dsc'>;
