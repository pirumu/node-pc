export enum BIN_ROUTES {
  GROUP = 'bins',
  GET_BINS = 'list',
  GET_BIN_BY_ID = 'id/:id',
  OPEN_BIN = 'open/:id',
  OPEN_ALL = 'open-all',
  ACTIVATE_BIN = 'active/:id',
  DEACTIVATE_BIN = 'inactive/:id',
  CONFIRM = 'confirm',
  REPLACE_ITEM = 'replace-item/:id',
  REMOVE_ITEM = 'remove-item/:id',
}
