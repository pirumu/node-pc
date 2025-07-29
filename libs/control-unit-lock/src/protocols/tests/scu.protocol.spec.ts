// import { createScuMessage, parseScuResponse, ScuCommand, SCU_MESSAGE_STRUCTURE } from '../scu/scu.protocol';
//
// describe('SCU Protocol Utilities', () => {
//   describe('createScuMessage', () => {
//     it('should create a valid GET_STATUS message', () => {
//       const options = {
//         deviceId: 0x64,
//         command: ScuCommand.GET_STATUS,
//         extraParam: 0x00,
//       };
//
//       const result = createScuMessage(options);
//       const expected = Buffer.from([
//         SCU_MESSAGE_STRUCTURE.HEADER, // 0xF5
//         0x64, // deviceId
//         ScuCommand.GET_STATUS, // 0x70
//         SCU_MESSAGE_STRUCTURE.RESERVED, // 0x00
//         0x00, // extraParam
//         SCU_MESSAGE_STRUCTURE.CONSTANT, // 0x5F
//         0x00, // checksum (mocked)
//         SCU_MESSAGE_STRUCTURE.RESERVED, // 0x00
//       ]);
//
//       // Update expected checksum based on mock implementation
//       expected[6] = (0xf5 + 0x64 + 0x70 + 0x00 + 0x00 + 0x5f) & 0xff;
//
//       expect(result).toEqual(expected);
//     });
//
//     it('should create a valid OPEN_LOCK message', () => {
//       const options = {
//         deviceId: 0x01,
//         command: ScuCommand.OPEN_LOCK,
//         extraParam: 0x00,
//       };
//
//       const result = createScuMessage(options);
//       const expected = Buffer.from([
//         SCU_MESSAGE_STRUCTURE.HEADER, // 0xF5
//         0x01, // deviceId
//         SCU_MESSAGE_STRUCTURE.RESERVED, // 0x00
//         ScuCommand.OPEN_LOCK, // 0x71
//         0x00, // extraParam
//         SCU_MESSAGE_STRUCTURE.CONSTANT, // 0x5F
//         0x00, // checksum (mocked)
//         SCU_MESSAGE_STRUCTURE.RESERVED, // 0x00
//       ]);
//
//       // Update expected checksum based on mock implementation
//       expected[6] = (0xf5 + 0x01 + 0x00 + 0x71 + 0x00 + 0x5f) & 0xff;
//
//       expect(result).toEqual(expected);
//     });
//
//     it('should use extraParam for GET_STATUS command', () => {
//       const options = {
//         deviceId: 0x02,
//         command: ScuCommand.GET_STATUS,
//         extraParam: 0xaa,
//       };
//
//       const result = createScuMessage(options);
//       expect(result[4]).toBe(0xaa); // extraParam should be in position 4
//     });
//
//     it('should ignore extraParam for OPEN_LOCK command', () => {
//       const options = {
//         deviceId: 0x02,
//         command: ScuCommand.OPEN_LOCK,
//         extraParam: 0xaa, // Should be ignored
//       };
//
//       const result = createScuMessage(options);
//       expect(result[4]).toBe(0x00); // Should be 0x00 regardless of extraParam
//     });
//
//     it('should always produce 8-byte messages', () => {
//       const options = {
//         deviceId: 0xff,
//         command: ScuCommand.GET_STATUS,
//       };
//
//       const result = createScuMessage(options);
//       expect(result.length).toBe(8);
//     });
//   });
//
//   describe('parseScuResponse', () => {
//     it('should validate a successful response with lock closed', () => {
//       const response = Buffer.from([
//         0xf5, // Header
//         0x01, // Device ID
//         0x00, // Reserved
//         0x10, // Status (success)
//         0x00, // Reserved
//         0x00, // Reserved
//         0x00, // Reserved
//         0x01, // Lock status (bit 0 = 1 = closed)
//       ]);
//
//       const result = parseScuResponse(response);
//       expect(result).toEqual({
//         isValid: true,
//         deviceId: 0x01,
//         isSuccess: true,
//         lockStatus: 'CLOSED',
//         raw: 'f501001000000001',
//       });
//     });
//
//     it('should validate a successful response with lock open', () => {
//       const response = Buffer.from([
//         0xf5, // Header
//         0x01, // Device ID
//         0x00, // Reserved
//         0x10, // Status (success)
//         0x00, // Reserved
//         0x00, // Reserved
//         0x00, // Reserved
//         0x00, // Lock status (bit 0 = 0 = open)
//       ]);
//
//       const result = parseScuResponse(response);
//       expect(result).toEqual({
//         isValid: true,
//         deviceId: 0x01,
//         isSuccess: true,
//         lockStatus: 'OPEN',
//         raw: 'f501001000000000',
//       });
//     });
//
//     it('should detect invalid header', () => {
//       const response = Buffer.from([
//         0xfa, // Invalid header
//         0x01, // Device ID
//         0x00, // Reserved
//         0x10, // Status (success)
//         0x00, // Reserved
//         0x00, // Reserved
//         0x00, // Reserved
//         0x00, // Lock status
//       ]);
//
//       const result = parseScuResponse(response);
//       expect(result.isValid).toBe(false);
//     });
//
//     it('should detect unsuccessful status', () => {
//       const response = Buffer.from([
//         0xf5, // Header
//         0x01, // Device ID
//         0x00, // Reserved
//         0x00, // Status (not success)
//         0x00, // Reserved
//         0x00, // Reserved
//         0x00, // Reserved
//         0x00, // Lock status
//       ]);
//
//       const result = parseScuResponse(response);
//       expect(result.isSuccess).toBe(false);
//       expect(result.lockStatus).toBeUndefined();
//     });
//
//     it('should handle incomplete responses', () => {
//       const response = Buffer.from([0xf5, 0x01]); // Only 2 bytes
//
//       const result = parseScuResponse(response);
//       expect(result.isValid).toBe(false);
//     });
//
//     it('should handle null/undefined input', () => {
//       const result = parseScuResponse(undefined as any);
//       expect(result.isValid).toBe(false);
//       expect(result.raw).toBe('null');
//     });
//
//     it('should return raw data in hex format', () => {
//       const response = Buffer.from([0xf5, 0x01, 0x00, 0x10, 0x00, 0x00, 0x00, 0x01]);
//       const result = parseScuResponse(response);
//       expect(result.raw).toBe('f501001000000001');
//     });
//   });
// });
