export const ITEM_ROUTES = {
  GROUP: 'items',
  ISSUE: 'issue',
  RETURN: 'return',
  REPLENISH: 'replenish',
  TYPES: 'types',

  CONFIGURE: 'configure',
} as const;

export const PROCESS_ITEM_TYPE = {
  ISSUE: 'issue',
  RETURN: 'return',
  REPLENISH: 'replenish',
} as const;

export const TRANSACTION_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;

export const QUEUE_NAMES = {
  PROCESS_ITEM: 'process-item',
} as const;

export const JOB_NAMES = {
  [QUEUE_NAMES.PROCESS_ITEM]: 'process-item-job',
} as const;
