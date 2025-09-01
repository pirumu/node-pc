import { resolve } from '@config/core';

export type FingerprintConfig = {
  enabled: boolean;
  binaryPath: string;
  deviceName: string;
  defaultPort: string;
};

export const getFingerprintConfig = (): FingerprintConfig => {
  return {
    enabled: resolve(
      'FINGERPRINT_ENABLED',
      (value) => {
        return String(value) === 'true';
      },
      { default: false },
    ),
    binaryPath: resolve(
      'FINGERPRINT_BINARY_PATH',
      (value) => {
        return String(value);
      },
      { require: process.env.FINGERPRINT_AUTH_ENABLED === 'true' },
    ),
    deviceName: resolve('FINGERPRINT_DEVICE_NAME', String, { default: '' }),
    defaultPort: resolve('FINGERPRINT_DEFAULT_PORT', String, {
      default: 'ttyACM10',
    }),
  };
};
