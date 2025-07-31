export const DETECT_SCU_PORT_MESSAGE = [0xf5, 0x64, 0x70, 0x00, 0x00, 0x5f, 0xc4] as const;
export const DETECT_CU_PORT_MESSAGE = [0x02, 0x00, 0x00, 0x60, 0x03, 0x65] as const;

// SCU - 8 bytes, header 0xF5
// await adapter.open('/dev/ttyUSB0', {
//   baudRate: 19200,
//   parser: { type: 'bytelength', options: { length: 8 } },
//   headerByte: 0xf5,
//   bufferStrategy: { type: 'time', timeMs: 100 },
//   reconnectStrategy: 'interval',
//   retryDelay: 6000,
// });
//
// // CU - 18 bytes, header 0x02
// await adapter.open('/dev/ttyUSB1', {
//   baudRate: 19200,
//   parser: { type: 'bytelength', options: { length: 18 } },
//   headerByte: 0x02,
//   bufferStrategy: { type: 'combined', timeMs: 200, size: 180 },
//   reconnectStrategy: 'exponential',
// });
