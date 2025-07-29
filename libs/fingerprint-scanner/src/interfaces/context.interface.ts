/** biome-ignore-all lint/suspicious/noExplicitAny: true */
import { FINGERPRINT_CMD } from '../enums/fingerprint.enum';

import { FingerprintResponse } from './response.interface';

export interface ICommandContext {
  id: string;
  command: FINGERPRINT_CMD;
  timestamp: Date;
  module?: string;
  metadata?: any;
}

export interface IContextualResponse extends FingerprintResponse {
  context?: ICommandContext;
  correlationId?: string;
}

export interface HookScope {
  context?: string;
  commands?: FINGERPRINT_CMD[];
  correlationId?: string;
  oneTime?: boolean;
}

export interface ContextConfig {
  name: string;
  isolated?: boolean;
  autoCleanup?: boolean;
}
