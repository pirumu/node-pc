export enum LOCK_STATUS {
  OPEN = 'OPEN',
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
