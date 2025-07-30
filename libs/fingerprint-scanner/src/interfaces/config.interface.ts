export interface IFingerprintScanConfig {
  binaryPath: string;
  devicePort: string;
  commandTimeout?: number;
  processTimeout?: number;
  retryAttempts?: number;
  logLevel?: 'debug' | 'error' | 'none';
  autoRestart?: boolean;
  autoRetry?: boolean;
  cleanupInterval?: number;
  maxCommandAge?: number;
}

export const DEFAULT_CONFIG: IFingerprintScanConfig = {
  binaryPath: './finger',
  devicePort: 'ttyACM10',
  commandTimeout: 10000,
  processTimeout: 5000,
  retryAttempts: 3,
  logLevel: 'error',
  autoRestart: true,
  autoRetry: true,
  cleanupInterval: 60 * 1000, // 1m
  maxCommandAge: 30000, // 30s
};
