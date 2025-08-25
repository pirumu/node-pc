export const EventType = {
  /** Events related to physical devices and their state */
  Loadcell: {
    Activated: 'loadcell/activated',
    StatusChanged: 'loadcell/status-changed',
    AllComputed: 'loadcell/all-computed', // Formerly BIN_DEVICES
  },

  /** Events related to Bins (cabinets/drawers) */
  Bin: {
    Opened: 'bin/opened',
    Closed: 'bin/closed',
    Computed: 'bin/computed', // Formerly BINS_TOTAL
  },

  /** Events related to Locks */
  Lock: {
    CuLockOpened: 'lock/cu-opened',
    OpenSuccess: 'lock/open-success',
    OpenFail: 'lock/open-fail',
    StatusChanged: 'lock/status-changed',
  },

  /** Events related to core business processes (Issue, Return, Replenish) */
  Process: {
    IssueSuccess: 'process/issue-success',
    IssueError: 'process/issue-error',
    IssueWarning: 'process/issue-warning',

    ReturnSuccess: 'process/return-success', // Assuming you might need this
    ReturnError: 'process/return-error',
    ReturnWarning: 'process/return-warning',

    ReplenishSuccess: 'process/replenish-success', // Assuming you might need this
    ReplenishError: 'process/replenish-error',
    ReplenishWarning: 'process/replenish-warning',

    ItemScanned: 'process/item-scanned', // Formerly SCAN_ITEM
  },

  /** Events related to network/service connections */
  Connection: {
    Cloud: 'connection/cloud',
    RfidDevice: 'connection/rfid-device',
    CuDevice: 'connection/cu-device',
    LoadCell: 'connection/load-cell',
  },
} as const;

type ObjectValues<T> = T[keyof T];
export type EventType = ObjectValues<ObjectValues<typeof EventType>>;

export enum COMMAND_TYPE {
  CU_LOCK_OPEN = 'cu_lock.open',
  CU_LOCK_GET_STATUS = 'cu_lock.get_status',
}
