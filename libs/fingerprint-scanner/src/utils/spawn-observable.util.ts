import { spawn, SpawnOptions, ChildProcessWithoutNullStreams } from 'child_process';

import { Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

export type SpawnObservableOptions = SpawnOptions & {
  logOutput?: boolean;
  logErrors?: boolean;
};

export type SpawnObservableResult = {
  type: 'stdout' | 'stderr' | 'close' | 'error';
  data: string | number | Error;
  timestamp: Date;
};

export type SpawnObservableWithProcess = {
  observable$: Observable<SpawnObservableResult>;
  childProcess: ChildProcessWithoutNullStreams;
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
      const spawnOpts: SpawnOptions = {
        ...spawnOptions,
        shell: process.platform === 'win32',
      };

      // @ts-ignore
      childProcess = spawn(command, args, spawnOpts);

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

export function spawnObservableWithProcess(
  command: string,
  args: string[] = [],
  options: SpawnObservableOptions = {},
  context?: string,
): SpawnObservableWithProcess {
  const cmdStr = `${command} ${args.join(' ')}`;
  const ctx = context || 'SpawnObservable';
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { logOutput = true, logErrors = true, ...spawnOptions } = options;

  let childProcess: ChildProcessWithoutNullStreams;

  const observable$ = new Observable<SpawnObservableResult>((observer) => {
    try {
      const spawnOpts: SpawnOptions = {
        ...spawnOptions,
        shell: process.platform === 'win32',
      };

      // @ts-ignore
      childProcess = spawn(command, args, spawnOpts);

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

    // Setup event handlers (same as above)
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

    childProcess.on('close', (code: number | null) => {
      const result = createResult('close', code ?? -1, new Date());
      if (code === 0) {
        observer.next(result);
        observer.complete();
      } else {
        observer.error(createResult('error', new Error(`Process failed with code ${code}`), new Date()));
      }
    });

    childProcess.on('error', (error: Error) => {
      observer.error(createResult('error', error, new Date()));
    });

    return cleanup;
  });

  // @ts-ignore
  return { observable$, childProcess };
}

function createResult(type: SpawnObservableResult['type'], data: string | number | Error, timestamp: Date): SpawnObservableResult {
  return { type, data, timestamp };
}
