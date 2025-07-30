export const LINUX_PORTS = ['/dev/ttyS0', '/dev/ttyS1', '/dev/ttyS2', '/dev/ttyS3', '/dev/ttyS4', '/dev/ttyS5'] as const;

// Constants for loadcell detection
export const CHAR_START = 0x55;
export const MESSAGE_LENGTH = 11;
export const VERIFY_TIMEOUT = 2000;
