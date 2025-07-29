/** biome-ignore-all lint/suspicious/noExplicitAny: true */
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Logger } from '@nestjs/common';

type BuilderFn = (...args: any[]) => string;

type CacheOptions = { ttl: number };

const CACHE_MANAGER_PROPERTY = 'cacheManager';

function CachedWithKey(cacheKey: string, options?: CacheOptions): MethodDecorator {
  const logger = new Logger(Cached.name);

  const Injector = Inject(CACHE_MANAGER);
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const methodName = key;

    Injector(target, CACHE_MANAGER_PROPERTY);

    descriptor.value = async function (...args: any[]) {
      if (!this[CACHE_MANAGER_PROPERTY]?.cacheEnabled()) {
        return await originalMethod.apply(this, args);
      }

      if (!cacheKey) {
        return await originalMethod.apply(this, args);
      }

      try {
        const value = await this.cacheService.get(cacheKey);
        if (value) {
          return JSON.parse(value);
        }
      } catch (err) {
        logger.error(`An error has occurred when extracting "key: ${cacheKey}" in "method: ${methodName}"`, err);
      }

      const response = await originalMethod.apply(this, args);

      try {
        await this.cacheService.set(cacheKey, JSON.stringify(response), options);
      } catch (err) {
        logger.error(`An error has occurred when inserting "key: ${cacheKey}" in "method: ${methodName}" with "value: ${response}"`, err);
      }

      return response;
    };
  };
}

function CachedWithBuilder(keyBuilder: BuilderFn, options?: CacheOptions): MethodDecorator {
  const logger = new Logger(CachedWithBuilder.name);

  const injectCache = Inject(CACHE_MANAGER);

  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    const methodName = key;

    injectCache(target, CACHE_MANAGER_PROPERTY);
    descriptor.value = async function (...args: any[]) {
      const cacheService = this[CACHE_MANAGER_PROPERTY];
      if (!cacheService?.cacheEnabled()) {
        return await originalMethod.apply(this, args);
      }

      const cacheKey = keyBuilder(...args);
      if (!cacheKey) {
        return await originalMethod.apply(this, args);
      }

      try {
        const value = await cacheService.get(cacheKey);
        if (value) {
          return JSON.parse(value);
        }
      } catch (err) {
        logger.error(`An error has occurred when extracting "key: ${cacheKey}" in "method: ${methodName}"`, err);
      }

      const response = await originalMethod.apply(this, args);

      try {
        await cacheService.setQuery(cacheKey, JSON.stringify(response), options);
      } catch (err) {
        logger.error(`An error has occurred when inserting "key: ${cacheKey}" in "method: ${methodName}" with "value: ${response}"`, err);
      }
      return response;
    };
  };
}

/**
 * Cache with key
 * @param {string} key
 * @param {CacheOptions} options
 * @constructor
 */
export function Cached(key: string, options?: CacheOptions): MethodDecorator;

/**
 * Cache with key builder
 * @param {BuilderFn} builder
 * @param {CacheOptions} options
 * @constructor
 */
export function Cached(builder: BuilderFn, options?: CacheOptions): MethodDecorator;

export function Cached(arg: string | BuilderFn, options?: CacheOptions): MethodDecorator {
  if (arg && typeof arg === 'string') {
    return CachedWithKey(arg, options);
  }
  return CachedWithBuilder(arg as unknown as BuilderFn, options);
}
