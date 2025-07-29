// Module
export { FingerprintScanModule } from './fingerprint-scan.module';

// Main Service
export { FingerprintScanService } from './services/fingerprint-scan.service';

// Context Services
export { FingerprintContextService, FingerprintContextInstance } from './services/fingerprint-context.service';
export { ContextManagerService } from './services/context-manager.service';
export { HookRegistryService } from './services/hook-registry.service';

// Core Services
export { FingerprintProcessService } from './services/fingerprint-process.service';
export { FingerprintCommandService } from './services/fingerprint-command.service';
export { FingerprintResponseService } from './services/fingerprint-response.service';

// Enums
export { FINGERPRINT_CMD, FINGERPRINT_RESPONSE_ID } from './enums/fingerprint.enum';

// Interfaces
export type { IFingerprintScanConfig } from './interfaces/config.interface';
export type { FingerprintResponse, ProcessEvent, CommandResult } from './interfaces/response.interface';
export type { ICommandContext, IContextualResponse, HookScope, ContextConfig } from './interfaces/context.interface';
export type {
  EnhancedResponseHookConfig,
  EnhancedCommandHookConfig,
  ProcessHookConfig,
  ErrorHookConfig,
  IContextualResponseHook,
  ContextualCommandHook,
  ProcessHook,
  ErrorHook,
} from './interfaces/hook.interface';

// Constants
export { DEFAULT_CONFIG } from './interfaces/config.interface';
