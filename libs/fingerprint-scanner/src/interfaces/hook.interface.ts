import { HookScope, IContextualResponse, ICommandContext } from './context.interface';
import { ProcessEvent, CommandResult } from './response.interface';

export type IContextualResponseHook = (response: IContextualResponse) => void | Promise<void>;
export type ContextualCommandHook = (result: CommandResult, context?: ICommandContext) => void | Promise<void>;
export type ProcessHook = (event: ProcessEvent) => void | Promise<void>;
export type ErrorHook = (error: Error, context: string) => void | Promise<void>;

export interface EnhancedResponseHookConfig {
  id?: string;
  handler: IContextualResponseHook;
  scope?: HookScope;
  priority?: number;
  once?: boolean;
  persistent?: boolean;
}

export interface EnhancedCommandHookConfig {
  id?: string;
  handler: ContextualCommandHook;
  scope?: HookScope;
  priority?: number;
  once?: boolean;
  persistent?: boolean;
}

export interface ProcessHookConfig {
  id?: string;
  handler: ProcessHook;
  eventTypes?: ProcessEvent['type'][];
  priority?: number;
  once?: boolean;
  persistent?: boolean;
}

export interface ErrorHookConfig {
  id?: string;
  handler: ErrorHook;
  contexts?: string[];
  priority?: number;
  once?: boolean;
  persistent?: boolean;
}
