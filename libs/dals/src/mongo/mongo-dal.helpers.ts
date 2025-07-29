import { Logger } from '@nestjs/common';

export function createIndexIfNotExist(key: string, createFn: () => unknown) {
  try {
    createFn();
  } catch (_error) {
    Logger.warn(`Index ${key} existed. Skip`, createIndexIfNotExist.name);
  }
}
