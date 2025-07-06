import { CacheEntry, LLMResponse, TaskCategory, EnhancementResult } from '../types';
import { Logger } from '../utils/logger';
import NodeCache from 'node-cache';

export class CacheService {
  private cache: NodeCache;
  private logger: Logger;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(ttl: number = 3600, maxSize: number = 1000) {
    this.logger = new Logger('CacheService');
    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: ttl * 0.2,
      useClones: false,
      maxKeys: maxSize
    });
    
    // Set up cache statistics
    this.cache.on('hit', () => this.hitCount++);
    this.cache.on('miss', () => this.missCount++);
    this.cache.on('expired', (key) => {
      this.logger.debug('Cache entry expired', { key });
    });
  }

  // Cache LLM responses
  public cacheResponse(prompt: string, modelName: string, response: LLMResponse): void {
    const key = this.generateResponseKey(prompt, modelName);
    const defaultTtl = this.cache.options?.stdTTL || 3600;
    
    const entry: CacheEntry = {
      key,
      value: { ...response, cached: true },
      timestamp: Date.now(),
      ttl: defaultTtl,
      hit_count: 0
    };
    
    this.cache.set(key, entry);
    this.logger.debug('Response cached', { key, model: modelName });
  }

  public getCachedResponse(prompt: string, modelName: string): LLMResponse | null {
    const key = this.generateResponseKey(prompt, modelName);
    const entry = this.cache.get<CacheEntry>(key);
    
    if (entry) {
      entry.hit_count++;
      this.logger.debug('Cache hit for response', { key, model: modelName });
      return entry.value as LLMResponse;
    }
    
    this.logger.debug('Cache miss for response', { key, model: modelName });
    return null;
  }

  // Cache task categorization results
  public cacheCategories(prompt: string, categories: TaskCategory[]): void {
    const key = this.generateCategoryKey(prompt);
    const defaultTtl = this.cache.options?.stdTTL || 3600;
    
    const entry: CacheEntry = {
      key,
      value: categories,
      timestamp: Date.now(),
      ttl: defaultTtl,
      hit_count: 0
    };
    
    this.cache.set(key, entry);
    this.logger.debug('Categories cached', { key, count: categories.length });
  }

  public getCachedCategories(prompt: string): TaskCategory[] | null {
    const key = this.generateCategoryKey(prompt);
    const entry = this.cache.get<CacheEntry>(key);
    
    if (entry) {
      entry.hit_count++;
      this.logger.debug('Cache hit for categories', { key });
      return entry.value as TaskCategory[];
    }
    
    this.logger.debug('Cache miss for categories', { key });
    return null;
  }

  // Cache enhancement results
  public cacheEnhancement(originalPrompt: string, enhancementResult: EnhancementResult): void {
    const key = this.generateEnhancementKey(originalPrompt);
    const defaultTtl = this.cache.options?.stdTTL || 3600;
    
    const entry: CacheEntry = {
      key,
      value: enhancementResult,
      timestamp: Date.now(),
      ttl: defaultTtl,
      hit_count: 0
    };
    
    this.cache.set(key, entry);
    this.logger.debug('Enhancement cached', { key });
  }

  public getCachedEnhancement(originalPrompt: string): EnhancementResult | null {
    const key = this.generateEnhancementKey(originalPrompt);
    const entry = this.cache.get<CacheEntry>(key);
    
    if (entry) {
      entry.hit_count++;
      this.logger.debug('Cache hit for enhancement', { key });
      return entry.value as EnhancementResult;
    }
    
    this.logger.debug('Cache miss for enhancement', { key });
    return null;
  }

  // Generic cache methods
  public set(key: string, value: any, ttl?: number): void {
    const defaultTtl = this.cache.options?.stdTTL || 3600;
    const finalTtl = ttl || defaultTtl;
    
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl: finalTtl,
      hit_count: 0
    };
    
    this.cache.set(key, entry, finalTtl);
    this.logger.debug('Generic cache set', { key });
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get<CacheEntry>(key);
    
    if (entry) {
      entry.hit_count++;
      this.logger.debug('Generic cache hit', { key });
      return entry.value as T;
    }
    
    this.logger.debug('Generic cache miss', { key });
    return null;
  }

  public delete(key: string): void {
    this.cache.del(key);
    this.logger.debug('Cache entry deleted', { key });
  }

  public clear(): void {
    this.cache.flushAll();
    this.hitCount = 0;
    this.missCount = 0;
    this.logger.info('Cache cleared');
  }

  // Cache statistics
  public getStats(): {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  } {
    const keys = this.cache.keys().length;
    const hits = this.hitCount;
    const misses = this.missCount;
    const hitRate = (hits + misses > 0) ? (hits / (hits + misses)) * 100 : 0;
    
    return {
      keys,
      hits,
      misses,
      hitRate: Math.round(hitRate * 100) / 100,
      size: keys
    };
  }

  public getDetailedStats(): {
    basic: ReturnType<CacheService['getStats']>;
    topKeys: { key: string; hits: number; age: number }[];
    memoryUsage: number;
  } {
    const basic = this.getStats();
    const allKeys = this.cache.keys();
    const topKeys = allKeys
      .map(key => {
        const entry = this.cache.get<CacheEntry>(key);
        return {
          key,
          hits: entry?.hit_count || 0,
          age: entry ? Date.now() - entry.timestamp : 0
        };
      })
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    // Rough memory usage estimation
    const memoryUsage = allKeys.reduce((total, key) => {
      const entry = this.cache.get<CacheEntry>(key);
      if (entry) {
        // Rough estimation: key size + value size
        return total + key.length + JSON.stringify(entry.value).length;
      }
      return total;
    }, 0);

    return {
      basic,
      topKeys,
      memoryUsage
    };
  }

  // Cache maintenance
  public prune(): void {
    // Remove expired entries
    const keys = this.cache.keys();
    let prunedCount = 0;
    
    keys.forEach(key => {
      const entry = this.cache.get<CacheEntry>(key);
      if (entry && Date.now() - entry.timestamp > entry.ttl * 1000) {
        this.cache.del(key);
        prunedCount++;
      }
    });
    
    this.logger.info('Cache pruned', { removed: prunedCount, remaining: this.cache.keys().length });
  }

  public resize(maxSize: number): void {
    const currentSize = this.cache.keys().length;
    
    if (currentSize > maxSize) {
      // Remove least recently used entries
      const keys = this.cache.keys();
      const entries = keys.map(key => ({
        key,
        entry: this.cache.get<CacheEntry>(key)
      }))
      .filter(item => item.entry)
      .sort((a, b) => (a.entry!.timestamp + a.entry!.hit_count) - (b.entry!.timestamp + b.entry!.hit_count));
      
      const toRemove = entries.slice(0, currentSize - maxSize);
      toRemove.forEach(item => this.cache.del(item.key));
      
      this.logger.info('Cache resized', { 
        removed: toRemove.length, 
        newSize: this.cache.keys().length,
        maxSize 
      });
    }
  }

  // Key generation helpers
  private generateResponseKey(prompt: string, modelName: string): string {
    return `response:${this.hash(prompt)}:${modelName}`;
  }

  private generateCategoryKey(prompt: string): string {
    return `categories:${this.hash(prompt)}`;
  }

  private generateEnhancementKey(prompt: string): string {
    return `enhancement:${this.hash(prompt)}`;
  }

  private hash(input: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    if (input.length === 0) return hash.toString();
    
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  // Warming and preloading
  public async warmCache(commonPrompts: string[], modelName: string): Promise<void> {
    this.logger.info('Starting cache warm-up', { prompts: commonPrompts.length, model: modelName });
    
    for (const prompt of commonPrompts) {
      const key = this.generateResponseKey(prompt, modelName);
      if (!this.cache.get(key)) {
        // Pre-cache with placeholder - real implementation would fetch actual responses
        const placeholder: LLMResponse = {
          content: '',
          tokens_used: { input: 0, output: 0, total: 0 },
          cost: 0,
          model: modelName,
          provider: 'placeholder',
          processing_time: 0,
          cached: true
        };
        this.cacheResponse(prompt, modelName, placeholder);
      }
    }
    
    this.logger.info('Cache warm-up completed');
  }

  public exportCache(): Record<string, any> {
    const keys = this.cache.keys();
    const exported: Record<string, any> = {};
    
    keys.forEach(key => {
      const entry = this.cache.get<CacheEntry>(key);
      if (entry) {
        exported[key] = entry;
      }
    });
    
    return exported;
  }

  public importCache(data: Record<string, any>): void {
    let importedCount = 0;
    
    Object.entries(data).forEach(([key, entry]) => {
      if (entry && typeof entry === 'object' && entry.value !== undefined) {
        const ttl = entry.ttl || this.cache.options?.stdTTL || 3600;
        this.cache.set(key, entry, ttl);
        importedCount++;
      }
    });
    
    this.logger.info('Cache imported', { entries: importedCount });
  }
} 