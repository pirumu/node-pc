// import { buildCuMessage, CuCommand } from '../cu/cu.protocol';
//
// describe('CU Protocol Implementation', () => {
//   describe('buildCuMessage', () => {
//     it('should build OPEN_LOCK message correctly', () => {
//       const message = buildCuMessage({
//         deviceId: 0x01,
//         command: CuCommand.OPEN_LOCK,
//         lockId: 1,
//         timeout: 0,
//       });
//
//       expect(message).toEqual(Buffer.from([0x02, 0x01, 0x00, 0x61, 0x00, 0x03, 0x67]));
//     });
//
//     it('should build GET_STATUS message correctly', () => {
//       const message = buildCuMessage({
//         deviceId: 0x02,
//         command: CuCommand.GET_STATUS,
//       });
//
//       expect(message).toEqual(Buffer.from([0x02, 0x02, 0x00, 0x60, 0x00, 0x03, 0x67]));
//     });
//   });
//
//   describe('parseCuResponse', () => {
//     it('should parse successful OPEN_LOCK response', () => {
//       // Format: [HEADER, DEVICE_ID, LOCK_ID, STATUS, RESERVED, CHECKSUM]
//       // Checksum = (0x02 + 0x01 + 0x00 + 0x75 + 0x00) & 0xFF = 0x78
//       const response = Buffer.from([0x02, 0x01, 0x00, 0x75, 0x00, 0x78]);
//       const result = parseCuResponse(response);
//
//       expect(result).toEqual({
//         isValid: true,
//         deviceId: 0x01,
//         isSuccess: true,
//         lockStatuses: { 1: 'OPEN' }, // Lock ID 1 (0x00 + 1)
//         raw: '020100750078',
//       });
//     });
//
//     it('should parse GET_STATUS response with lock states', () => {
//       // Format: [HEADER, DEV_ID, 0x00, STATUS, DATA_LEN, DATA..., CHECKSUM]
//       // Test data with 3 status bytes (24 locks):
//       // - First byte 0x01 (lock 1 closed, others open)
//       // - Second byte 0x00 (all open)
//       // - Third byte 0xFF (all closed)
//       const responseBytes = [
//         0x02,
//         0x01,
//         0x00,
//         0x75,
//         0x03, // Header
//         0x01,
//         0x00,
//         0xff, // Status data
//         0x7b, // checksum (0x02+0x01+0x00+0x75+0x03+0x01+0x00+0xFF = 0x17B & 0xFF = 0x7B)
//       ];
//       const response = Buffer.from(responseBytes);
//
//       const result = parseCuResponse(response);
//       expect(result.isValid).toBe(true);
//       expect(result.isSuccess).toBe(true);
//       expect(result.lockStatuses).toEqual({
//         '1': 'CLOSED',
//         '2': 'OPEN',
//         '3': 'OPEN',
//         '4': 'OPEN',
//         '5': 'OPEN',
//         '6': 'OPEN',
//         '7': 'OPEN',
//         '8': 'OPEN',
//         '9': 'OPEN',
//         '10': 'OPEN',
//         '11': 'OPEN',
//         '12': 'OPEN',
//         '13': 'OPEN',
//         '14': 'OPEN',
//         '15': 'OPEN',
//         '16': 'OPEN',
//         '17': 'CLOSED',
//         '18': 'CLOSED',
//         '19': 'CLOSED',
//         '20': 'CLOSED',
//         '21': 'CLOSED',
//         '22': 'CLOSED',
//         '23': 'CLOSED',
//         '24': 'CLOSED',
//       });
//     });
//
//     it('should detect invalid checksum', () => {
//       const response = Buffer.from([0x02, 0x01, 0x00, 0x75, 0x00, 0x00]); // Invalid checksum
//       const result = parseCuResponse(response);
//       expect(result.isValid).toBe(false);
//     });
//
//     it('should handle too-short responses', () => {
//       const response = Buffer.from([0x02, 0x01, 0x00]); // Only 3 bytes
//       const result = parseCuResponse(response);
//       expect(result.isValid).toBe(false);
//     });
//   });
// });
