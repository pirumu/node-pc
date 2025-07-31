import { Command, LOCK_STATUS, ProtocolType } from '../protocol.constants';
import { calculateChecksum } from '../protocol.helper';
import { IProtocol, MessageOptions, MessagesOptions } from '../protocol.interface';

import { CU_MESSAGE_STRUCTURE, CuCommand, CuResponseStatus, DEFAULT_LOCK_IDS } from './cu.constants';
import { CuResponse } from './cu.types';

export class CuProtocol implements IProtocol<CuResponse> {
  public getProtocolType(): ProtocolType {
    return ProtocolType.CU;
  }

  private _mapCommand(command: Command): CuCommand {
    switch (command) {
      case Command.GET_STATUS:
        return CuCommand.GET_STATUS;
      case Command.OPEN_LOCK:
        return CuCommand.OPEN_LOCK;
      default:
        throw new Error(`Unsupported command: ${command}`);
    }
  }

  /**
   * Builds CU protocol message
   *
   * Message Structure (6 bytes):
   * +--------+-----------+--------+-----------+-----------+---------+
   * | Byte 0 | Byte 1    | Byte 2 | Byte 3    | Byte 4    | Byte 5  |
   * +--------+-----------+--------+-----------+-----------+---------+
   * | Header | Device ID | LockID | Command   | Constant  | Checksum|
   * | 0x02   | 0x00-0xFF | 0x00   | 0x60/0x61 | 0x03      | Calculated |
   * +--------+-----------+--------+-----------+-----------+---------+
   *
   * For OPEN_LOCK: LockID is the target lock (0-47)
   * For GET_STATUS: LockID should be 0x00
   */
  public createMessage({ deviceId, command, lockId = 0 }: MessageOptions): Buffer {
    const cuCommand = this._mapCommand(command);

    // Convert to protocol lock ID (0-47)
    const protocolLockId = Math.max(0, Math.min(lockId - 1, 47));

    const message = [CU_MESSAGE_STRUCTURE.HEADER, deviceId, protocolLockId, cuCommand, CU_MESSAGE_STRUCTURE.CONSTANT];

    // Calculate checksum (sum of all bytes except checksum)
    const checksum = calculateChecksum(message);

    return Buffer.from([...message, checksum]);
  }

  /**
   * Parses CU protocol response
   *
   * Response Structure varies by command:
   *
   * OPEN_LOCK Response (6 bytes):
   * +--------+-----------+--------+-----------+-----------+---------+
   * | Header | Device ID | LockID | Status    | Reserved  | Checksum|
   * | 0x02   | 0x00-0xFF | 0x00   | 0x75      | 0x00      | 0xXX    |
   * +--------+-----------+--------+-----------+-----------+---------+
   *
   * GET_STATUS Response (variable length):
   * +--------+-----------+--------+-----------+-----------+-------------------+---------+
   * | Header | Device ID | 0x00   | Status    | Data Len  | Status Data       | Checksum|
   * | 0x02   | 0x00-0xFF | 0x00   | 0x75      | 0x06      | 6 bytes (48 locks)| 0xXX    |
   * +--------+-----------+--------+-----------+-----------+-------------------+---------+
   */
  public parseResponse(deviceId: number, lockIds: number[], data: Buffer): CuResponse {
    if (lockIds.length === 0) {
      lockIds = DEFAULT_LOCK_IDS;
    }
    // Basic validation
    if (!data || data.length < 6) {
      return {
        deviceId: deviceId,
        isSuccess: false,
        lockStatuses: {},
      };
    }

    const bytes = Array.from(data);

    // Validate response structure - matching JS logic
    const header = bytes[0];
    const nonValidateDeviceId = bytes[1];
    const statusByte = bytes[3];

    // Check if response is valid: header = 0x02, deviceId matches, status = 0x75
    const isValidResponse = header === CU_MESSAGE_STRUCTURE.HEADER && statusByte === 0x75;
    const isDeviceIdMatch = deviceId === nonValidateDeviceId;
    const isSuccess = isValidResponse && isDeviceIdMatch;

    const result: CuResponse = {
      deviceId,
      isSuccess,
      lockStatuses: {},
    };

    if (isSuccess) {
      // For GET_STATUS response (variable length > 6)
      if (bytes.length > 6) {
        for (const lockId of lockIds) {
          const byteIndex = Math.floor((lockId - 1) / 8);
          const bitIndex = (lockId - 1) % 8;
          const dataByte = bytes[4 + byteIndex];

          if (dataByte !== undefined) {
            const statusBit = (dataByte >> bitIndex) & 0x01;
            result.lockStatuses[lockId] = statusBit === 1 ? LOCK_STATUS.CLOSED : LOCK_STATUS.OPEN;
          }
        }
      }
      // For OPEN_LOCK response (exactly 6 bytes)
      else if (bytes.length === 6) {
        const lockId = bytes[2] + 1; // Convert back to 1-based index
        result.lockStatuses = {
          [lockId]: LOCK_STATUS.OPEN, // Successful open command response
        };
      }
    }

    return result;
  }

  public createMessages({ deviceId, command, lockIds = [] }: MessagesOptions): Buffer[] {
    if (lockIds.length === 0) {
      if (command === Command.GET_STATUS) {
        return [this.createMessage({ deviceId, command, lockId: 0 })];
      }

      lockIds = DEFAULT_LOCK_IDS;
    }
    return lockIds.map((lockId) => {
      return this.createMessage({ deviceId, command, lockId });
    });
  }
}
