// utils/cache.ts
import Redis from 'ioredis';

// Create a single, shared Redis client instance
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(redisUrl);

const CACHE_EXPIRY_SECONDS = 60 * 60; // Cache for 1 hour
const CACHE_KEY_SEPARATOR = '::';

/**
 * A higher-order function that wraps an async function with Redis caching.
 * @param keyPrefix A prefix for the Redis key to namespace the cache.
 * @param fn The async function to be cached.
 * @returns A new function that is a cached version of the original.
 */
export const cacheWithRedis = <TFunc extends (...args: any[]) => Promise<any>>(
  keyPrefix: string,
  fn: TFunc,
): TFunc => {
  return (async (...args: Parameters<TFunc>) => {
    // Create a unique key based on the function's arguments
    const key = `${keyPrefix}${CACHE_KEY_SEPARATOR}${JSON.stringify(args)}`;

    try {
      // 1. Try to get the result from Redis
      const cachedResult = await redis.get(key);
      if (cachedResult) {
        console.log(`[CACHE HIT] for key: ${key}`);
        return JSON.parse(cachedResult);
      }

      console.log(`[CACHE MISS] for key: ${key}`);
      // 2. If not in cache, execute the original function
      const result = await fn(...args);

      // 3. Store the new result in Redis with an expiration time
      await redis.set(key, JSON.stringify(result), 'EX', CACHE_EXPIRY_SECONDS);
      return result;
    } catch (redisError) {
      // If Redis fails, fall back to executing the function without caching
      console.warn(`[REDIS ERROR] Falling back to no cache: ${redisError}`);
      return await fn(...args);
    }
  }) as TFunc;
}; 