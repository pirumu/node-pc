export enum ScuCommand {
  GET_STATUS = 0x70,
  OPEN_LOCK = 0x71,
}

export enum ScuResponseStatus {
  SUCCESS = 0x10,
  FAILURE = 0x00,
}

export enum SCU_MESSAGE_STRUCTURE {
  HEADER = 0xf5,
  RESERVED = 0x00,
  CONSTANT = 0x5f,
}

export const SCU_DETECTION_MESSAGE = Buffer.from([0xf5, 0x64, 0x70, 0x00, 0x00, 0x5f, 0xc4]);
