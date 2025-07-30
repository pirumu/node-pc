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
  public parseResponse(data: Buffer): CuResponse {
    // Basic validation
    if (!data || data.length < 6) {
      return {
        isValid: false,
        deviceId: 0,
        isSuccess: false,
        raw: data?.toString('hex') || 'null',
        lockStatuses: {},
      };
    }

    const bytes = Array.from(data);

    // Verify checksum
    const messageWithoutChecksum = bytes.slice(0, -1);
    const lastByte = calculateChecksum(messageWithoutChecksum);
    const isValidChecksum = lastByte === bytes[bytes.length - 1];

    // Validate header
    const isValid = bytes[0] === CU_MESSAGE_STRUCTURE.HEADER && isValidChecksum;
    const deviceId = bytes[1];
    const statusByte = bytes[3];
    const isSuccess = statusByte === CuResponseStatus.SUCCESS;

    const result: CuResponse = {
      isValid,
      deviceId,
      isSuccess,
      raw: data.toString('hex'),
      lockStatuses: {},
    };

    // Parse lock statuses
    if (isSuccess) {
      // For GET_STATUS response
      if (bytes.length > 6) {
        const dataLength = bytes[4];
        const statusData = bytes.slice(5, 5 + dataLength);

        for (let byteIndex = 0; byteIndex < statusData.length; byteIndex++) {
          const byte = statusData[byteIndex];
          for (let bit = 0; bit < 8; bit++) {
            const lockId = byteIndex * 8 + bit + 1; // Convert to 1-based index
            const isClosed = (byte >> bit) & 0x01;
            result.lockStatuses[lockId] = isClosed ? LOCK_STATUS.CLOSED : LOCK_STATUS.OPEN;
          }
        }
      }
      // For OPEN_LOCK response
      else if (bytes.length === 6) {
        const lockId = bytes[2] + 1; // Convert to 1-based index
        result.lockStatuses = {
          [lockId]: LOCK_STATUS.OPEN, // Successful open means lock is now open
        };
      }
    }

    return result;
  }

  public createMessages({ deviceId, command, lockIds = [], timeout = 0 }: MessagesOptions): Buffer[] {
    if (lockIds.length === 0) {
      lockIds = DEFAULT_LOCK_IDS;
    }
    return lockIds.map((lockId) => {
      return this.createMessage({ deviceId, command, lockId, timeout });
    });
  }
}
