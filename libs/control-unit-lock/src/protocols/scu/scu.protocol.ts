import { Command, LOCK_STATUS, ProtocolType } from '../protocol.constants';
import { calculateChecksum } from '../protocol.helper';
import { IProtocol, MessageOptions, MessagesOptions } from '../protocol.interface';

import { SCU_MESSAGE_STRUCTURE, ScuCommand, ScuResponseStatus } from './scu.constants';
import { ScuResponse } from './scu.types';

export class ScuProtocol implements IProtocol<ScuResponse> {
  public getProtocolType(): ProtocolType {
    return ProtocolType.SCU;
  }

  private _mapCommand(command: Command): ScuCommand {
    switch (command) {
      case Command.GET_STATUS:
        return ScuCommand.GET_STATUS;
      case Command.OPEN_LOCK:
        return ScuCommand.OPEN_LOCK;
      default:
        throw new Error(`Unsupported command: ${command}`);
    }
  }

  /**
   * Create SCU Message (8 bytes total)
   *
   * Message Structure:
   * +--------+------------+---------------+---------------+-------------+----------+----------+---------+---------+
   * | Byte # | 0          | 1             | 2             | 3           | 4        | 5        | 6       | 7       |
   * +--------+------------+---------------+---------------+-------------+----------+----------+---------+---------+
   * | Name   | Header     | Device ID     | Status Cmd    | Open Cmd    | Extra    | Constant | Checksum| Padding |
   * | Value  | 0xF5       | 0x00-0xFF     | 0x70 or 0x00  | 0x71 or 0x00| 0x00     | 0x5F     | Calc    | 0x00    |
   * +--------+------------+---------------+---------------+-------------+----------+----------+---------+---------+
   *
   * IMPORTANT NOTES:
   * 1. Command position varies by type (this is how the original hardware works):
   *    - GET_STATUS (0x70): Placed at byte[2]
   *    - OPEN_LOCK (0x71): Placed at byte[3]
   *
   * 2. Checksum calculation:
   *    - Calculated on first 6 bytes only (bytes 0-5)
   *    - Formula: sum(bytes[0-5]) & 0xFF
   *
   * 3. Example messages:
   *    - Identify/Status: [0xF5, 0x64, 0x70, 0x00, 0x00, 0x5F, 0xC4, 0x00]
   *    - Open Lock:       [0xF5, 0x01, 0x00, 0x71, 0x00, 0x5F, 0xC6, 0x00]
   *
   * @param deviceId - Target device ID (0-255)
   * @param command - Command to send (GET_STATUS or OPEN_LOCK)
   * @param extraParam - Additional parameter (used with GET_STATUS)
   * @returns Buffer containing the 8-byte message
   */
  public createMessage({ deviceId, command }: MessageOptions): Buffer {
    const scuCommand = this._mapCommand(command);
    // Initialize 8-byte message with all zeros
    const message = new Array(8).fill(0x00);

    // Byte 0: Header - Always 0xF5
    message[0] = SCU_MESSAGE_STRUCTURE.HEADER;

    // Byte 1: Device ID - Target device address
    message[1] = deviceId;

    // Bytes 2-3: Command placement (varies by command type)
    // This matches the original hardware behavior
    if (scuCommand === ScuCommand.GET_STATUS) {
      // Status command goes in byte 2
      message[2] = command; // 0x70
      message[3] = SCU_MESSAGE_STRUCTURE.RESERVED; // Not used for status
    } else if (scuCommand === ScuCommand.OPEN_LOCK) {
      // Open command goes in byte 3 (different position!)
      message[2] = SCU_MESSAGE_STRUCTURE.RESERVED; // Not used for open
      message[3] = command; // 0x71
    }
    message[4] = SCU_MESSAGE_STRUCTURE.RESERVED; // Not used for open

    // Byte 5: Constant value - Always 0x5F
    message[5] = SCU_MESSAGE_STRUCTURE.CONSTANT;

    // Byte 6: Checksum - Sum of bytes 0-5
    const checksumData = message.slice(0, 6);
    message[6] = calculateChecksum(checksumData);

    // Byte 7: Padding - Always 0x00
    message[7] = 0x00;

    return Buffer.from(message);
  }

  /**
   * Parse SCU Response (8 bytes)
   *
   * Response Structure:
   * +--------+--------+------------+--------+---------+--------+--------+----------+------------+
   * | Byte # | 0      | 1          | 2      | 3       | 4      | 5      | 6        | 7          |
   * +--------+--------+------------+--------+---------+--------+--------+----------+------------+
   * | Name   | Header | Device ID  | Reserved| Status | Reserved| Reserved| Reserved | Lock Status|
   * | Check  | =0xF5? | Match req? | -      | =0x10? | -      | -      | -        | Bit 0      |
   * +--------+--------+------------+--------+---------+--------+--------+----------+------------+
   *
   * Success Indicators:
   * - byte[0] = 0xF5 (valid header)
   * - byte[1] = requested device ID
   * - byte[3] = 0x10 (success status)
   *
   * Lock Status (only valid if success):
   * - byte[7] & 0x01:
   *   - 0 = Open
   *   - 1 = Closed
   */
  public parseResponse(deviceId: number, lockIds: number[], data: Buffer): ScuResponse {
    // Ensure we have 8 bytes
    if (!data || data.length < 8) {
      return {
        deviceId: 0,
        isSuccess: false,
        lockStatus: LOCK_STATUS.UNKNOWN,
      };
    }

    // Extract device ID
    const extractDeviceId = data[1];

    // Check success status
    const isSuccess = extractDeviceId === deviceId && data[3] === ScuResponseStatus.SUCCESS;

    // Extract lock status from bit 0 of byte 7
    const lockStatusBit = data[7] & 0x01;
    const lockStatus = lockStatusBit ? LOCK_STATUS.CLOSED : LOCK_STATUS.OPENED;

    return {
      deviceId,
      isSuccess,
      lockStatus: isSuccess ? lockStatus : LOCK_STATUS.UNKNOWN,
    };
  }

  public createMessages(_: MessagesOptions): Buffer<Buffer>[] {
    throw new Error('SCU protocol not supported');
  }
}
