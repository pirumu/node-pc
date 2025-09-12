export const EVENT_TYPE = {
  CARD: {
    SCAN: 'card/scan',
    SCANNED: 'card/scanned',
    CONNECTED: 'card/connected',
  },
  LOADCELL: {
    // request
    START_READING: 'loadcell/start',
    STOP_READING: 'loadcell/stop',
    ACTIVATE: 'loadcell/activate',

    // response
    ACTIVATED: 'loadcell/activated',
    STATUS_CHANGED: 'loadcell/status-changed',
    ALL_COMPUTED: 'loadcell/all-computed',
    WEIGHT_CALCULATED: 'loadcell/weight-calculated',
    QUANTITY_CALCULATED: 'loadcell/quantity-calculated',
    ERROR: 'loadcell/error',
  },

  BIN: {
    OPENED: 'bin/opened',
    CLOSED: 'bin/closed',
  },

  LOCK: {
    OPEN: 'lock/open',
    STATUS: 'lock/status',
    TRACKING: 'lock/track',
    TRACKING_STATUS: 'lock/track/status',
    OPEN_SUCCESS: 'lock/open-success',
    OPEN_FAIL: 'lock/open-fail',
    STATUS_CHANGED: 'lock/status-changed',
    FAILED_ATTEMPTS_EXCEEDED: 'lock/failed-attempts-exceeded',
  },

  /** Events related to core business processes (Issue, Return, Replenish) */
  PROCESS: {
    BIN_FAILED: 'process/bin/failed',
    START: 'process/start',
    STEP_START: 'process/step-start',
    STEP_SUCCESS: 'process/step-success',
    STEP_ERROR: 'process/step-error',
    STEP_WARNING: 'process/step-warning',

    INTERNAL_STEP_SUCCESS: 'process/internal-step-success',
    INTERNAL_STEP_ERROR: 'process/internal-step-error',

    QTY_CHANGED: 'process/item-qty-changed',

    INSTRUCTION: 'process/instruction',
    CALCULATE_ITEM: 'process/calculate-item',
    ISSUE_STEP_SUCCESS: 'process/step/issue-success',
    ISSUE_STEP_ERROR: 'process/issue-error',
    ISSUE_STEP_WARNING: 'process/issue-warning',

    ISSUE_SUCCESS: 'process/issue-success',
    ISSUE_ERROR: 'process/issue-error',
    ISSUE_WARNING: 'process/issue-warning',

    FORCE_NEXT_STEP: 'process/force-next-step',

    RETURN_STEP_SUCCESS: 'process/step/return-success',
    RETURN_STEP_ERROR: 'process/return-error',
    RETURN_STEP_WARNING: 'process/return-warning',

    RETURN_SUCCESS: 'process/return-success',
    RETURN_ERROR: 'process/return-error',
    RETURN_WARNING: 'process/return-warning',

    REPLENISH_SUCCESS: 'process/replenish-success',
    REPLENISH_ERROR: 'process/replenish-error',
    REPLENISH_WARNING: 'process/replenish-warning',

    REPLENISH_STEP_SUCCESS: 'process/step/replenish-success',
    REPLENISH_STEP_ERROR: 'process/replenish-error',
    REPLENISH_STEP_WARNING: 'process/replenish-warning',

    ITEM_SCANNED: 'process/item-scanned',

    TRANSACTION_STARTED: 'process/transaction-started',
    TRANSACTION_COMPLETED: 'process/transaction-completed',
    TRANSACTION_FAILED: 'process/transaction-failed',
  },

  /** Events related to network/service connections */
  CONNECTION: {
    CLOUD: 'connection/cloud',
    RFID_DEVICE: 'connection/rfid-device',
    CU_DEVICE: 'connection/cu-device',
    LOAD_CELL: 'connection/load-cell',
    MQTT_CONNECTED: 'connection/mqtt-connected',
    MQTT_DISCONNECTED: 'connection/mqtt-disconnected',
  },

  /** System and maintenance events */
  SYSTEM: {
    STARTUP: 'system/startup',
    SHUTDOWN: 'system/shutdown',
    ERROR: 'system/error',
    WARNING: 'system/warning',
    MAINTENANCE_MODE: 'system/maintenance-mode',
    CALIBRATION_MODE: 'system/calibration-mode',

    PORT_DISCOVERING: 'system/port-discovering',
  },

  /** User and authentication events */
  USER: {
    LOGIN: 'user/login',
    LOGOUT: 'user/logout',
    ACCESS_GRANTED: 'user/access-granted',
    ACCESS_DENIED: 'user/access-denied',
    RFID_SCANNED: 'user/rfid-scanned',
  },
} as const;

export type LoadcellEventType = (typeof EVENT_TYPE.LOADCELL)[keyof typeof EVENT_TYPE.LOADCELL];
export type CardEventType = (typeof EVENT_TYPE.CARD)[keyof typeof EVENT_TYPE.CARD];
export type BinEventType = (typeof EVENT_TYPE.BIN)[keyof typeof EVENT_TYPE.BIN];
export type LockEventType = (typeof EVENT_TYPE.LOCK)[keyof typeof EVENT_TYPE.LOCK];
export type ProcessEventType = (typeof EVENT_TYPE.PROCESS)[keyof typeof EVENT_TYPE.PROCESS];
export type ConnectionEventType = (typeof EVENT_TYPE.CONNECTION)[keyof typeof EVENT_TYPE.CONNECTION];
export type SystemEventType = (typeof EVENT_TYPE.SYSTEM)[keyof typeof EVENT_TYPE.SYSTEM];
export type UserEventType = (typeof EVENT_TYPE.USER)[keyof typeof EVENT_TYPE.USER];

export type AnyEventType =
  | LoadcellEventType
  | BinEventType
  | LockEventType
  | ProcessEventType
  | ConnectionEventType
  | SystemEventType
  | UserEventType
  | CardEventType;
