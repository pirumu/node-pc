import { LoadcellHeartbeatEvent } from '@common/business/events/device/loadcell-heartbeat.event';

export enum EVENT_TYPE {
  TRACE_CU_LOCK_OPEN = 'cu/lockOpen',
  DEVICE_ACTIVATED = 'device/active',

  BIN_OPENED = 'bin/open',
  BIN_CLOSED = 'bin/close',

  ISSUE_SUCCESS = 'processItem/success',
  ISSUE_PROCESSING = 'lock/openSuccess',

  /**Listen realtime CU lock, loadcells ... */
  // RFID_DEVICE = 'rfid/connect',
  CU_DEVICE = 'cu/connect',
  LOAD_CELLS = 'loadcell/connect',
  CLOUD_CONNECT = 'cloud/connect',

  /**Listen all device realtime */
  BIN_DEVICES = 'device/computed',

  BINS_TOTAL = 'bin/computed',

  BIN_LOCK_STATUS = 'lock/status',

  // DEVICE_STATUS = 'device/status',

  OPEN_BIN_FAIL = 'lock/openFail',

  ISSUE_ERROR = 'issue/error',
  REPLENISH_ERROR = 'replenish/error',
  RETURN_ERROR = 'return/error',

  ISSUE_WARNING = 'issue/warning',

  RETURN_WARNING = 'return/warning',
  REPLENISH_WARNING = 'replenish/warning',

  SCAN_ITEM = 'scan-item',

  CONFIRM_PROCESS = 'process-item/error',

  CARD_SCAN = 'card/scan',
  CARD_DEVICE_CONNECTED = 'rfid/connect',
  LOAD_CELLS_WEIGHT_CALCULATED = 'device/weight',

  LOAD_CELLS_HEARTBEAT = 'device/status',
}
