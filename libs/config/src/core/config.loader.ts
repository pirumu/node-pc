import { join } from 'path';

export function resolveEnvPath(fileName = '.env'): string {
  return process.env.APP_ENV === undefined ? join(__dirname, fileName) : '';
}
