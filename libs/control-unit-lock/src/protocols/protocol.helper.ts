/**
 * Calculate checksum for serial protocol messages
 *
 * The checksum is calculated by:
 * 1. Sum all bytes in the array
 * 2. Take only the least significant byte (& 0xFF)
 *
 * @param data - Array of bytes to calculate checksum for
 * @returns Checksum value (0-255)
 */
export function calculateChecksum(data: number[]): number {
  let sum = 0;

  for (const byte of data) {
    sum += byte;
  }

  // Return only the least significant byte
  return sum & 0xff;
}

/**
 * Verify checksum of a message
 *
 * @param message - Complete message including checksum
 * @param checksumIndex - Index of checksum byte in message
 * @returns true if checksum is valid
 */
export function verifyChecksum(message: Buffer, checksumIndex: number): boolean {
  if (message.length <= checksumIndex) {
    return false;
  }

  // Calculate checksum on data before checksum byte
  const dataToCheck = Array.from(message.slice(0, checksumIndex));
  const calculatedChecksum = calculateChecksum(dataToCheck);
  const messageChecksum = message[checksumIndex];

  return calculatedChecksum === messageChecksum;
}

/**
 * Convert a hex string to Buffer for testing
 * Example: "F56470000005FC400" -> Buffer
 */
export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/**
 * Format buffer as hex string with spaces for readability
 * Example: Buffer -> "F5 64 70 00 00 5F C4 00"
 */
export function formatHex(buffer: Buffer): string {
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}
