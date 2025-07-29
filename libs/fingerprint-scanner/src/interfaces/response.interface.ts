import { FINGERPRINT_RESPONSE_ID } from '../enums/fingerprint.enum';

export type FingerprintResponse = {
  id: FINGERPRINT_RESPONSE_ID;
  data: string;
  timestamp: Date;
  command?: number;
};

export type ProcessEvent = {
  type: 'stdout' | 'stderr' | 'close' | 'error';
  data: string | number | Error;
  timestamp: Date;
};

export type CommandResult = {
  success: boolean;
  commandSent: Date;
  command: number;
  error?: string;
  correlationId?: string;
};
