/** biome-ignore-all lint/suspicious/noExplicitAny: true */
import { Logger, LoggerService } from '@nestjs/common';

export function createAppLogger(ctx: string): LoggerService {
  return new Logger(ctx);
}

export function logWithFields(
  level: 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal',
  message: string,
  fields: Record<string, any>,
  context?: string,
) {
  const objArg = {
    ...fields,
    context,
  };

  Logger[level](message, objArg);
}

export function logActivity(activity: string, metadata: Record<string, any>, context?: string) {
  logWithFields(
    'log',
    `Activity: ${activity}`,
    {
      activity,
      activityLog: true,
      ...metadata,
    },
    context,
  );
}

export function logPerformance(operation: string, duration: number, metadata?: Record<string, any>, context?: string) {
  logWithFields(
    'log',
    `Performance: ${operation}`,
    {
      operation,
      duration,
      performanceLog: true,
      ...metadata,
    },
    context,
  );
}

export function logEvent(eventType: string, eventData: Record<string, any>, context?: string) {
  logWithFields(
    'log',
    `Event: ${eventType}`,
    {
      eventType,
      eventData,
      isEvent: true,
    },
    context,
  );
}

export function logSecurity(event: string, metadata: Record<string, any>, context?: string) {
  logWithFields(
    'warn',
    `Security Event: ${event}`,
    {
      securityEvent: true,
      event,
      ...metadata,
    },
    context,
  );
}

export function logAudit(action: string, metadata: Record<string, any>, context?: string) {
  logWithFields(
    'log',
    `Audit: ${action}`,
    {
      auditLog: true,
      action,
      ...metadata,
    },
    context,
  );
}
