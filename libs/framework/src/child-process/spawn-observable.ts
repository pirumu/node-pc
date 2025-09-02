import { spawn, SpawnOptions, ChildProcessWithoutNullStreams } from 'child_process';

import { Logger } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export type SpawnObservableOptions = SpawnOptions & {
  logOutput?: boolean;
  logErrors?: boolean;
};

export type SpawnObservableResult = {
  type: 'stdout' | 'stderr' | 'close' | 'error';
  data: string | number | Error;
  timestamp: Date;
};

export function spawnObservable(
  command: string,
  args: string[] = [],
  options: SpawnObservableOptions = {},
  context?: string,
): Observable<SpawnObservableResult> {
  const cmdStr = `${command} ${args.join(' ')}`;
  const ctx = context || 'SpawnObservable';
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { logOutput = true, logErrors = true, ...spawnOptions } = options;

  return new Observable<SpawnObservableResult>((observer) => {
    let childProcess: ChildProcessWithoutNullStreams;

    try {
      // @ts-ignore
      childProcess = spawn(command, args, {
        ...spawnOptions,
        shell: process.platform === 'win32',
      });

      if (logOutput) {
        Logger.log(`Executing: ${cmdStr}`, ctx);
      }
    } catch (error) {
      Logger.error(`Failed to spawn process: ${error.message}`, ctx);
      observer.error(createResult('error', error, new Date()));
      return;
    }

    const cleanup = () => {
      if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM');
      }
    };

    childProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (logOutput && output) {
        Logger.log(output, ctx);
      }
      observer.next(createResult('stdout', output, new Date()));
    });

    childProcess.stderr.on('data', (data: Buffer) => {
      const errorOutput = data.toString().trim();
      if (logErrors && errorOutput) {
        Logger.warn(`stderr: ${errorOutput}`, ctx);
      }
      observer.next(createResult('stderr', errorOutput, new Date()));
    });

    childProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      const result = createResult('close', code ?? -1, new Date());

      if (code === 0) {
        if (logOutput) {
          Logger.log(`Process completed successfully: ${cmdStr}`, ctx);
        }
        observer.next(result);
        observer.complete();
      } else {
        const errorMsg = signal ? `Process terminated by signal ${signal}: ${cmdStr}` : `Process failed with exit code ${code}: ${cmdStr}`;

        if (logErrors) {
          Logger.error(errorMsg, ctx);
        }
        observer.error(createResult('error', new Error(errorMsg), new Date()));
      }
    });

    childProcess.on('error', (error: Error) => {
      const enhancedError = new Error(`Child process error for command "${cmdStr}": ${error.message}`);
      enhancedError.cause = error;

      if (logErrors) {
        Logger.error(enhancedError.message, ctx);
      }
      observer.error(createResult('error', enhancedError, new Date()));
    });

    return cleanup;
  });
}

function createResult(type: SpawnObservableResult['type'], data: string | number | Error, timestamp: Date): SpawnObservableResult {
  return { type, data, timestamp };
}

export function spawnObservableStdout(
  command: string,
  args: string[] = [],
  options: SpawnObservableOptions = {},
  context?: string,
): Observable<string> {
  return spawnObservable(command, args, options, context).pipe(
    filter((result) => result.type === 'stdout'),
    map((result) => result.data as string),
  );
}

export async function executeCommand(command: string, args: string[] = [], options: SpawnObservableOptions = {}): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const outputs: string[] = [];

    spawnObservable(command, args, options).subscribe({
      next: (result) => {
        if (result.type === 'stdout') {
          outputs.push(result.data as string);
        }
      },
      complete: () => resolve(outputs),
      error: (errorResult) => reject(errorResult.data),
    });
  });
}
