import { redis } from './cache.js';
import { Config } from '../types/config.js';
import { ResearchContext, ResearchResult } from '../types/schemas.js';

export class MemoryStore {
  private ttl: number;

  constructor(config: Config) {
    this.ttl = config.redis.ttl || 3600; // 1 hour default
  }

  // Research Context Management
  async saveContext(researchId: string, context: ResearchContext): Promise<void> {
    try {
      await redis.set(
        `context:${researchId}`,
        JSON.stringify(context),
        'EX',
        this.ttl
      );
      console.log(`[MEMORY] Saved context for research ${researchId}`);
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to save context: ${error}`);
    }
  }

  async getContext(researchId: string): Promise<ResearchContext | null> {
    try {
      const data = await redis.get(`context:${researchId}`);
      if (data) {
        console.log(`[MEMORY] Retrieved context for research ${researchId}`);
        return JSON.parse(data) as ResearchContext;
      }
      return null;
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to get context: ${error}`);
      return null;
    }
  }

  // Research Results Management
  async saveResult(researchId: string, result: ResearchResult): Promise<void> {
    try {
      await redis.set(
        `result:${researchId}`,
        JSON.stringify(result),
        'EX',
        this.ttl
      );
      console.log(`[MEMORY] Saved result for research ${researchId}`);
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to save result: ${error}`);
    }
  }

  async getResult(researchId: string): Promise<ResearchResult | null> {
    try {
      const data = await redis.get(`result:${researchId}`);
      if (data) {
        console.log(`[MEMORY] Retrieved result for research ${researchId}`);
        return JSON.parse(data) as ResearchResult;
      }
      return null;
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to get result: ${error}`);
      return null;
    }
  }

  // Status and Progress Tracking
  async setStatus(researchId: string, status: string): Promise<void> {
    try {
      await redis.set(`status:${researchId}`, status, 'EX', this.ttl);
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to set status: ${error}`);
    }
  }

  async getStatus(researchId: string): Promise<string | null> {
    try {
      return await redis.get(`status:${researchId}`);
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to get status: ${error}`);
      return null;
    }
  }

  // Task Progress Management
  async saveTaskProgress(researchId: string, taskId: string, progress: any): Promise<void> {
    try {
      await redis.set(
        `progress:${researchId}:${taskId}`,
        JSON.stringify(progress),
        'EX',
        this.ttl
      );
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to save task progress: ${error}`);
    }
  }

  async getTaskProgress(researchId: string, taskId: string): Promise<any> {
    try {
      const data = await redis.get(`progress:${researchId}:${taskId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to get task progress: ${error}`);
      return null;
    }
  }

  // Session and Workspace Management
  async getAllActiveResearch(): Promise<string[]> {
    try {
      const keys = await redis.keys('context:*');
      return keys.map(key => key.replace('context:', ''));
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to get active research: ${error}`);
      return [];
    }
  }

  async cleanupExpired(): Promise<void> {
    try {
      // Redis handles EX expiry automatically, but we can manually clean specific patterns
      const expiredKeys = await redis.keys('result:*');
      if (expiredKeys.length > 0) {
        // Additional cleanup logic if needed
        console.log(`[MEMORY] Found ${expiredKeys.length} result keys for potential cleanup`);
      }
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to cleanup: ${error}`);
    }
  }

  // Search Results Caching (extends existing cache functionality)
  async cacheSearchResults(query: string, results: any, ttlSeconds?: number): Promise<void> {
    try {
      await redis.set(
        `search:${query}`,
        JSON.stringify(results),
        'EX',
        ttlSeconds || 1800 // 30 minutes for search results
      );
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to cache search results: ${error}`);
    }
  }

  async getCachedSearchResults(query: string): Promise<any> {
    try {
      const data = await redis.get(`search:${query}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to get cached search results: ${error}`);
      return null;
    }
  }

  // Utility methods
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to check key existence: ${error}`);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await redis.del(key);
      return result === 1;
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to delete key: ${error}`);
      return false;
    }
  }

  async deleteResearch(researchId: string): Promise<void> {
    try {
      const keys = await redis.keys(`*:${researchId}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`[MEMORY] Deleted ${keys.length} keys for research ${researchId}`);
      }
    } catch (error) {
      console.warn(`[MEMORY ERROR] Failed to delete research data: ${error}`);
    }
  }
} 