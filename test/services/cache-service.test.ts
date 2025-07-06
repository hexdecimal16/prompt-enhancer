import { CacheService } from '../../src/services/cache-service';
import { LLMResponse, TaskCategory, EnhancementResult } from '../../src/types';

// Mock NodeCache
jest.mock('node-cache');

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockNodeCache: any;

  beforeEach(() => {
    mockNodeCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushAll: jest.fn(),
      keys: jest.fn(() => []),
      on: jest.fn(),
      options: { stdTTL: 3600 }
    };

    const NodeCache = require('node-cache');
    NodeCache.mockImplementation(() => mockNodeCache);

    cacheService = new CacheService(3600, 1000);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const defaultCacheService = new CacheService();
      expect(defaultCacheService).toBeInstanceOf(CacheService);
    });

    it('should initialize with custom TTL and max size', () => {
      const customCacheService = new CacheService(7200, 500);
      expect(customCacheService).toBeInstanceOf(CacheService);
    });

    it('should set up event handlers', () => {
      expect(mockNodeCache.on).toHaveBeenCalledWith('hit', expect.any(Function));
      expect(mockNodeCache.on).toHaveBeenCalledWith('miss', expect.any(Function));
      expect(mockNodeCache.on).toHaveBeenCalledWith('expired', expect.any(Function));
    });
  });

  describe('LLM Response Caching', () => {
    const mockResponse: LLMResponse = {
      content: 'Test response',
      tokens_used: { input: 10, output: 20, total: 30 },
      cost: 0.001,
      model: 'test-model',
      provider: 'test-provider',
      processing_time: 100,
      cached: false
    };

    describe('cacheResponse', () => {
      it('should cache LLM response correctly', () => {
        cacheService.cacheResponse('test prompt', 'test-model', mockResponse);

        expect(mockNodeCache.set).toHaveBeenCalledWith(
          expect.stringContaining('response:'),
          expect.objectContaining({
            key: expect.any(String),
            value: expect.objectContaining({ ...mockResponse, cached: true }),
            timestamp: expect.any(Number),
            ttl: 3600,
            hit_count: 0
          })
        );
      });
    });

    describe('getCachedResponse', () => {
      it('should return cached response when available', () => {
        const cachedEntry = {
          key: 'test-key',
          value: { ...mockResponse, cached: true },
          timestamp: Date.now(),
          ttl: 3600,
          hit_count: 0
        };

        mockNodeCache.get.mockReturnValue(cachedEntry);

        const result = cacheService.getCachedResponse('test prompt', 'test-model');

        expect(result).toEqual({ ...mockResponse, cached: true });
        expect(cachedEntry.hit_count).toBe(1);
      });

      it('should return null when no cached response exists', () => {
        mockNodeCache.get.mockReturnValue(null);

        const result = cacheService.getCachedResponse('test prompt', 'test-model');

        expect(result).toBeNull();
      });
    });
  });

  describe('Task Categories Caching', () => {
    const mockCategories: TaskCategory[] = [
      {
        name: 'Test Category',
        confidence: 0.9,
        keywords_matched: ['test'],
        system_prompt: 'Test system prompt',
        priority: 1
      }
    ];

    describe('cacheCategories', () => {
      it('should cache categories correctly', () => {
        cacheService.cacheCategories('test prompt', mockCategories);

        expect(mockNodeCache.set).toHaveBeenCalledWith(
          expect.stringContaining('categories:'),
          expect.objectContaining({
            key: expect.any(String),
            value: mockCategories,
            timestamp: expect.any(Number),
            ttl: 3600,
            hit_count: 0
          })
        );
      });
    });

    describe('getCachedCategories', () => {
      it('should return cached categories when available', () => {
        const cachedEntry = {
          key: 'test-key',
          value: mockCategories,
          timestamp: Date.now(),
          ttl: 3600,
          hit_count: 0
        };

        mockNodeCache.get.mockReturnValue(cachedEntry);

        const result = cacheService.getCachedCategories('test prompt');

        expect(result).toEqual(mockCategories);
        expect(cachedEntry.hit_count).toBe(1);
      });

      it('should return null when no cached categories exist', () => {
        mockNodeCache.get.mockReturnValue(null);

        const result = cacheService.getCachedCategories('test prompt');

        expect(result).toBeNull();
      });
    });
  });

  describe('Enhancement Results Caching', () => {
    const mockEnhancement: EnhancementResult = {
      original_prompt: 'Original prompt',
      enhanced_prompt: 'Enhanced prompt',
      categories: [],
      model_used: 'test-model',
      provider: 'test-provider',
      estimated_tokens: 50,
      estimated_cost: 0.001,
      enhancement_strategies: ['clarity'],
      quality_score: 0.8,
      processing_time: 200
    };

    describe('cacheEnhancement', () => {
      it('should cache enhancement result correctly', () => {
        cacheService.cacheEnhancement('original prompt', mockEnhancement);

        expect(mockNodeCache.set).toHaveBeenCalledWith(
          expect.stringContaining('enhancement:'),
          expect.objectContaining({
            key: expect.any(String),
            value: mockEnhancement,
            timestamp: expect.any(Number),
            ttl: 3600,
            hit_count: 0
          })
        );
      });
    });

    describe('getCachedEnhancement', () => {
      it('should return cached enhancement when available', () => {
        const cachedEntry = {
          key: 'test-key',
          value: mockEnhancement,
          timestamp: Date.now(),
          ttl: 3600,
          hit_count: 0
        };

        mockNodeCache.get.mockReturnValue(cachedEntry);

        const result = cacheService.getCachedEnhancement('original prompt');

        expect(result).toEqual(mockEnhancement);
        expect(cachedEntry.hit_count).toBe(1);
      });

      it('should return null when no cached enhancement exists', () => {
        mockNodeCache.get.mockReturnValue(null);

        const result = cacheService.getCachedEnhancement('original prompt');

        expect(result).toBeNull();
      });
    });
  });

  describe('Generic Cache Methods', () => {
    describe('set', () => {
      it('should set value with default TTL', () => {
        cacheService.set('test-key', 'test-value');

        expect(mockNodeCache.set).toHaveBeenCalledWith(
          'test-key',
          expect.objectContaining({
            key: 'test-key',
            value: 'test-value',
            timestamp: expect.any(Number),
            ttl: 3600,
            hit_count: 0
          }),
          3600
        );
      });

      it('should set value with custom TTL', () => {
        cacheService.set('test-key', 'test-value', 7200);

        expect(mockNodeCache.set).toHaveBeenCalledWith(
          'test-key',
          expect.objectContaining({
            ttl: 7200
          }),
          7200
        );
      });
    });

    describe('get', () => {
      it('should return value when key exists', () => {
        const cachedEntry = {
          key: 'test-key',
          value: 'test-value',
          timestamp: Date.now(),
          ttl: 3600,
          hit_count: 0
        };

        mockNodeCache.get.mockReturnValue(cachedEntry);

        const result = cacheService.get('test-key');

        expect(result).toBe('test-value');
        expect(cachedEntry.hit_count).toBe(1);
      });

      it('should return null when key does not exist', () => {
        mockNodeCache.get.mockReturnValue(null);

        const result = cacheService.get('non-existent-key');

        expect(result).toBeNull();
      });
    });

    describe('delete', () => {
      it('should delete cache entry', () => {
        cacheService.delete('test-key');

        expect(mockNodeCache.del).toHaveBeenCalledWith('test-key');
      });
    });

    describe('clear', () => {
      it('should clear all cache entries and reset counters', () => {
        cacheService.clear();

        expect(mockNodeCache.flushAll).toHaveBeenCalled();
      });
    });
  });

  describe('Statistics', () => {
    describe('getStats', () => {
      it('should return cache statistics', () => {
        mockNodeCache.keys.mockReturnValue(['key1', 'key2', 'key3']);
        
        // Simulate hit and miss events
        const hitHandler = mockNodeCache.on.mock.calls.find((call: any) => call[0] === 'hit')[1];
        const missHandler = mockNodeCache.on.mock.calls.find((call: any) => call[0] === 'miss')[1];
        
        hitHandler();
        hitHandler();
        missHandler();

        const stats = cacheService.getStats();

        expect(stats).toEqual({
          keys: 3,
          hits: 2,
          misses: 1,
          hitRate: 66.67,
          size: 3
        });
      });

      it('should handle zero hits and misses', () => {
        mockNodeCache.keys.mockReturnValue([]);

        const stats = cacheService.getStats();

        expect(stats.hitRate).toBe(0);
      });
    });

    describe('getDetailedStats', () => {
      it('should return detailed cache statistics', () => {
        const mockKeys = ['key1', 'key2', 'key3'];
        mockNodeCache.keys.mockReturnValue(mockKeys);
        
        const mockEntries = [
          { key: 'key1', value: 'value1', hit_count: 5, timestamp: Date.now() - 1000 },
          { key: 'key2', value: 'value2', hit_count: 3, timestamp: Date.now() - 2000 },
          { key: 'key3', value: 'value3', hit_count: 1, timestamp: Date.now() - 3000 }
        ];

        mockNodeCache.get.mockImplementation((key: string) => {
          return mockEntries.find(entry => entry.key === key);
        });

        const detailedStats = cacheService.getDetailedStats();

        expect(detailedStats.basic).toBeDefined();
        expect(detailedStats.topKeys).toHaveLength(3);
        expect(detailedStats.topKeys[0].hits).toBe(5); // Should be sorted by hits
        expect(detailedStats.memoryUsage).toBeGreaterThan(0);
      });

      it('should handle entries with missing data', () => {
        mockNodeCache.keys.mockReturnValue(['key1']);
        mockNodeCache.get.mockReturnValue(null);

        const detailedStats = cacheService.getDetailedStats();

        expect(detailedStats.topKeys).toHaveLength(1);
        expect(detailedStats.topKeys[0].hits).toBe(0);
      });
    });
  });

  describe('Cache Management', () => {
    describe('prune', () => {
      it('should remove expired and least used entries', () => {
        const mockKeys = ['key1', 'key2', 'key3'];
        mockNodeCache.keys.mockReturnValue(mockKeys);
        
        const oldTimestamp = Date.now() - 10000000; // Very old
        const mockEntries = [
          { key: 'key1', value: 'value1', hit_count: 1, timestamp: oldTimestamp, ttl: 3600 },
          { key: 'key2', value: 'value2', hit_count: 10, timestamp: Date.now(), ttl: 3600 },
          { key: 'key3', value: 'value3', hit_count: 0, timestamp: Date.now(), ttl: 3600 }
        ];

        mockNodeCache.get.mockImplementation((key: string) => {
          return mockEntries.find(entry => entry.key === key);
        });

        cacheService.prune();

        // Should delete expired entries only
        expect(mockNodeCache.del).toHaveBeenCalledTimes(1);
        expect(mockNodeCache.del).toHaveBeenCalledWith('key1');
      });
    });

    describe('resize', () => {
      it('should limit cache to new max size', () => {
        const mockKeys = ['key1', 'key2', 'key3', 'key4', 'key5'];
        mockNodeCache.keys.mockReturnValue(mockKeys);
        
        const mockEntries = mockKeys.map((key, index) => ({
          key,
          value: `value${index}`,
          hit_count: index,
          timestamp: Date.now()
        }));

        mockNodeCache.get.mockImplementation((key: string) => {
          return mockEntries.find(entry => entry.key === key);
        });

        cacheService.resize(3);

        // Should delete 2 least used entries
        expect(mockNodeCache.del).toHaveBeenCalledTimes(2);
        expect(mockNodeCache.del).toHaveBeenCalledWith('key1'); // hit_count: 0
        expect(mockNodeCache.del).toHaveBeenCalledWith('key2'); // hit_count: 1
      });
    });
  });

  describe('Key Generation', () => {
    it('should generate consistent keys for same inputs', () => {
      const prompt = 'test prompt';
      const model = 'test-model';

      cacheService.cacheResponse(prompt, model, {} as LLMResponse);
      cacheService.getCachedResponse(prompt, model);

      const setCalls = mockNodeCache.set.mock.calls;
      const getCalls = mockNodeCache.get.mock.calls;

      expect(setCalls[0][0]).toBe(getCalls[0][0]); // Same key used
    });
  });

  describe('Warm Cache', () => {
    it('should warm cache with common prompts', async () => {
      const commonPrompts = ['prompt1', 'prompt2'];
      const modelName = 'test-model';

      // Mock the promise resolution
      const warmPromise = cacheService.warmCache(commonPrompts, modelName);
      
      // This method likely makes async calls, so we just verify it doesn't throw
      await expect(warmPromise).resolves.not.toThrow();
    });
  });

  describe('Import/Export Cache', () => {
    describe('exportCache', () => {
      it('should export cache data', () => {
        mockNodeCache.keys.mockReturnValue(['key1', 'key2']);
        const mockEntries = {
          key1: { value: 'value1' },
          key2: { value: 'value2' }
        };
        
        mockNodeCache.get.mockImplementation((key: string) => mockEntries[key as keyof typeof mockEntries]);

        const exported = cacheService.exportCache();

        expect(exported).toEqual({
          key1: { value: 'value1' },
          key2: { value: 'value2' }
        });
      });
    });

    describe('importCache', () => {
      it('should import cache data', () => {
        const importData = {
          key1: { value: 'value1', ttl: 3600 },
          key2: { value: 'value2', ttl: 7200 }
        };

        cacheService.importCache(importData);

        expect(mockNodeCache.set).toHaveBeenCalledTimes(2);
        expect(mockNodeCache.set).toHaveBeenCalledWith('key1', expect.any(Object), 3600);
        expect(mockNodeCache.set).toHaveBeenCalledWith('key2', expect.any(Object), 7200);
      });

      it('should handle import data without TTL', () => {
        const importData = {
          key1: { value: 'value1' }
        };

        cacheService.importCache(importData);

        expect(mockNodeCache.set).toHaveBeenCalledWith('key1', expect.any(Object), 3600); // Default TTL
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined options in NodeCache', () => {
      mockNodeCache.options = undefined;
      const cacheServiceNoOptions = new CacheService();
      
      cacheServiceNoOptions.set('test', 'value');
      
      expect(mockNodeCache.set).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ ttl: 3600 }),
        3600
      );
    });

    it('should handle circular reference in hash generation', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      // Should not throw when caching circular objects
      expect(() => {
        cacheService.set('circular', circularObj);
      }).not.toThrow();
    });
  });
}); 