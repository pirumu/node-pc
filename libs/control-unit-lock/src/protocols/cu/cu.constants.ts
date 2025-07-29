export enum CuCommand {
  GET_STATUS = 0x60,
  OPEN_LOCK = 0x61,
}

export enum CuResponseStatus {
  SUCCESS = 0x75,
  FAILURE = 0x00,
}

export enum CU_MESSAGE_STRUCTURE {
  HEADER = 0x02,
  CONSTANT = 0x03,
}
// let MESS_CU_TEMP = [0x02, 0x00, 0x00, 0x61, 0x03, 0x66]

export const DEFAULT_LOCK_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
];

export const CU_DETECTION_MESSAGE = Buffer.from([0x02, 0x00, 0x00, 0x60, 0x03, 0x65]);
