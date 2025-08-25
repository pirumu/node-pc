export enum LOCK_STATUS {
  OPENED = 'OPENED',
  CLOSED = 'CLOSED',
  UNKNOWN = 'UNKNOWN',
}

export enum ProtocolType {
  CU = 'CU',
  SCU = 'SCU',
}

export enum Command {
  GET_STATUS = 'GET_STATUS',
  OPEN_LOCK = 'OPEN_LOCK',
}
