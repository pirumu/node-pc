export const CLIENT_ID_KEY = 'x-client-id';

export enum PROCESS_ITEM_TYPE {
  ISSUE = 'issue',
  RETURN = 'return',
  REPLENISH = 'replenish',
}

export enum CONDITION_TYPE {
  WORKING = 'Working',
  DAMAGE = 'Damage',
  INCOMPLETE = 'Incomplete',
  FINISHED = 'Finished',
}
