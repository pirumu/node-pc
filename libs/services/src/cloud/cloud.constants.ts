export const CLOUD_PATHS = {
  LOGIN: '/api/v1/login',
  GET_LIST_USER: '/api/v1/users',
  GET_LIST_CLUSTER: '/api/v1/clusters',
  GET_LIST_LOADCELL: '/api/v1/loadcells',
  GET_LIST_ITEM: '/api/v1/items',
  GET_LIST_CONDITION: '/api/v1/conditions',
  GET_LIST_WORKING_ORDER: '/api/v1/working-orders',
  GET_LIST_CABINET: '/api/v1/cabinets',
  GET_LIST_AREA: '/api/v1/areas',
  GET_LIST_BIN: '/api/v1/bins',
  GET_LIST_ITEM_TYPE: '/api/v1/item-types',

  UPDATE_CARD_USER: '/api/v1/users/update-cards',
  GET_LIST_JOB_CARD: '/api/v1/job-cards',
  UPDATE_JOB_CARD: '/api/v1/job-cards/update-many',

  UPDATE_STATUS_BIN: '/api/v1/configure/bins/update-status-bins',
  SYNC_TRANSACTIONS: '/api/v1/taking-transaction/create',
  UPDATE_QUANTITY_ONHOLD: '/api/v1/spares/update-qty-oh',
  GET_NOTIFICATION_SETTING: '/api/v1/settings/schedule',
} as const;
