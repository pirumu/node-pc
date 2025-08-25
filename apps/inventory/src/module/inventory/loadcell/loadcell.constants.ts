export enum LOADCELL_ROUTES {
  GROUP = 'loadcells',
  GET_LOADCELLS = '/',
  GET_LOADCELL = ':id',
  CALIBRATE_LOADCELL = ':id/actions/calibrate',
  ACTIVATE_LOADCELL = ':id/actions/activate',
  UNASSIGN_LOADCELL = ':id/actions/unassign',
}
