export enum BIN_ROUTES {
  GROUP = 'bins',
  GET_BINS = '/',
  GET_BIN_BY_ID = ':id',
  OPEN_BINS = 'actions/open',
  OPEN_BIN = ':id/actions/open',
  ACTIVATE_BIN = ':id/actions/activate',
  DEACTIVATE_BIN = ':id/actions/deactivate',
}
