import { PromptEnhancerMCPServer } from '../src/mcp-server';

// Mock dependencies
jest.mock('../src/config/configuration-manager');
jest.mock('../src/services');
jest.mock('../src/providers');
jest.mock('../src/utils/logger');

// Mock MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
    close: jest.fn()
  }))
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({}))
}));

describe('PromptEnhancerMCPServer', () => {
  let server: PromptEnhancerMCPServer;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create MCP server instance', async () => {
      const { ConfigurationManager } = require('../src/config/configuration-manager');
      const { createProvider } = require('../src/providers');
      
      // Mock a provider that will be returned by createProvider
      const mockProvider = {
        name: 'test-provider',
        generate: jest.fn(),
        isAvailable: jest.fn().mockReturnValue(true),
        getAvailableModels: jest.fn().mockReturnValue(['test-enhancer']),
        estimateTokens: jest.fn().mockReturnValue(100),
        estimateCost: jest.fn().mockReturnValue(0.001)
      };
      
      ConfigurationManager.create = jest.fn().mockResolvedValue({
        getAvailableModels: jest.fn().mockReturnValue([
          { name: 'test-model', provider: 'test-provider', enabled: true, cost_per_token: 0.001, max_tokens: 4096, priority: 1 }
        ]),
        getCategories: jest.fn().mockReturnValue({}),
        getConfiguration: jest.fn().mockReturnValue({
          models: {
            enhancers: [
              { name: 'test-enhancer', provider: 'test-provider', enabled: true, cost_per_token: 0.001, max_tokens: 4096, priority: 1 }
            ],
            classifiers: [],
            fallback_models: []
          },
          user_preferences: { max_cost_per_request: 0.1, prioritize_speed: false, enable_caching: true, quality_over_cost: false },
          providers: [
            { name: 'test-provider', api_key: 'test-key', models: [] }
          ]
        }),
        getCacheSettings: jest.fn().mockReturnValue({ ttl: 3600, max_size: 1000 })
      });

      // Mock createProvider to return our mock provider
      createProvider.mockReturnValue(mockProvider);

      server = await PromptEnhancerMCPServer.create();
      
      expect(server).toBeInstanceOf(PromptEnhancerMCPServer);
    });

    it('should handle configuration creation errors', async () => {
      const { ConfigurationManager } = require('../src/config/configuration-manager');
      ConfigurationManager.create = jest.fn().mockRejectedValue(new Error('Config error'));

      await expect(PromptEnhancerMCPServer.create()).rejects.toThrow('Config error');
    });
  });

  describe('server lifecycle', () => {
    beforeEach(async () => {
      const { ConfigurationManager } = require('../src/config/configuration-manager');
      const { createProvider } = require('../src/providers');
      
      // Mock a provider
      const mockProvider = {
        name: 'test-provider',
        generate: jest.fn(),
        isAvailable: jest.fn().mockReturnValue(true),
        getAvailableModels: jest.fn().mockReturnValue(['test-enhancer']),
        estimateTokens: jest.fn().mockReturnValue(100),
        estimateCost: jest.fn().mockReturnValue(0.001)
      };
      
      ConfigurationManager.create = jest.fn().mockResolvedValue({
        getAvailableModels: jest.fn().mockReturnValue([
          { name: 'test-model', provider: 'test-provider', enabled: true, cost_per_token: 0.001, max_tokens: 4096, priority: 1 }
        ]),
        getCategories: jest.fn().mockReturnValue({}),
        getConfiguration: jest.fn().mockReturnValue({
          models: {
            enhancers: [
              { name: 'test-enhancer', provider: 'test-provider', enabled: true, cost_per_token: 0.001, max_tokens: 4096, priority: 1 }
            ],
            classifiers: [],
            fallback_models: []
          },
          user_preferences: { max_cost_per_request: 0.1, prioritize_speed: false, enable_caching: true, quality_over_cost: false },
          providers: [
            { name: 'test-provider', api_key: 'test-key', models: [] }
          ]
        }),
        getCacheSettings: jest.fn().mockReturnValue({ ttl: 3600, max_size: 1000 })
      });

      createProvider.mockReturnValue(mockProvider);
      server = await PromptEnhancerMCPServer.create();
    });

    it('should start server', async () => {
      await expect(server.start()).resolves.not.toThrow();
    });

    it('should stop server', async () => {
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('tool handlers', () => {
    beforeEach(async () => {
      const { ConfigurationManager } = require('../src/config/configuration-manager');
      const { createProvider } = require('../src/providers');
      
      // Mock a provider
      const mockProvider = {
        name: 'test-provider',
        generate: jest.fn(),
        isAvailable: jest.fn().mockReturnValue(true),
        getAvailableModels: jest.fn().mockReturnValue(['test-enhancer']),
        estimateTokens: jest.fn().mockReturnValue(100),
        estimateCost: jest.fn().mockReturnValue(0.001)
      };
      
      const mockConfig = {
        getAvailableModels: jest.fn().mockReturnValue([
          { name: 'test-model', provider: 'test-provider', enabled: true, cost_per_token: 0.001, max_tokens: 4096, priority: 1 }
        ]),
        getCategories: jest.fn().mockReturnValue({
          'test_category': {
            name: 'Test Category',
            description: 'Test',
            keywords: ['test'],
            system_prompt: 'Test prompt',
            priority: 1,
            token_cost: 0.001,
            compatibility: ['test-model'],
            confidence_threshold: 0.7
          }
        }),
        getConfiguration: jest.fn().mockReturnValue({
          models: {
            enhancers: [
              { name: 'test-enhancer', provider: 'test-provider', enabled: true, cost_per_token: 0.001, max_tokens: 4096, priority: 1 }
            ],
            classifiers: [],
            fallback_models: []
          },
          user_preferences: { max_cost_per_request: 0.1, prioritize_speed: false, enable_caching: true, quality_over_cost: false },
          providers: [
            { name: 'test-provider', api_key: 'test-key', models: [] }
          ]
        }),
        getCacheSettings: jest.fn().mockReturnValue({ ttl: 3600, max_size: 1000 })
      };
      ConfigurationManager.create = jest.fn().mockResolvedValue(mockConfig);
      createProvider.mockReturnValue(mockProvider);

      // Mock services
      const { TaskCategorizer, ModelDecisionEngine, PromptEnhancer, CacheService } = require('../src/services');
      
      TaskCategorizer.mockImplementation(() => ({
        analyzeComplexity: jest.fn().mockResolvedValue({
          categories: [{ name: 'Test Category', confidence: 0.8, keywords_matched: ['test'], system_prompt: 'Test', priority: 1 }],
          complexity_score: 0.5,
          recommended_model: { name: 'test-model', provider: 'test-provider' },
          estimated_cost: 0.001,
          confidence: 0.8
        }),
        categorizeTask: jest.fn().mockResolvedValue([])
      }));

      ModelDecisionEngine.mockImplementation(() => ({
        getModelRecommendations: jest.fn().mockResolvedValue([
          {
            selected_model: { name: 'test-model', provider: 'test-provider' },
            provider: { name: 'test-provider' },
            reasoning: 'Test reasoning',
            estimated_cost: 0.001,
            estimated_tokens: 100,
            quality_score: 0.8,
            speed_score: 0.7,
            cost_efficiency: 0.9
          }
        ])
      }));

      PromptEnhancer.mockImplementation(() => ({
        enhancePrompt: jest.fn().mockResolvedValue({
          original_prompt: 'Test prompt',
          enhanced_prompt: 'Enhanced test prompt',
          categories: [],
          model_used: 'test-model',
          provider: 'test-provider',
          estimated_tokens: 100,
          estimated_cost: 0.001,
          enhancement_strategies: ['clarity'],
          quality_score: 0.8,
          processing_time: 200
        })
      }));

      CacheService.mockImplementation(() => ({
        getStats: jest.fn().mockReturnValue({
          keys: 10,
          hits: 8,
          misses: 2,
          hitRate: 80,
          size: 10
        }),
        clear: jest.fn()
      }));

      server = await PromptEnhancerMCPServer.create();
    });

    it('should set up tool handlers correctly', () => {
      const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
      const serverInstance = Server.mock.results[0].value;
      
      expect(serverInstance.setRequestHandler).toHaveBeenCalled();
    });
  });

  describe('provider initialization', () => {
    it('should handle provider initialization errors', async () => {
      const { ConfigurationManager } = require('../src/config/configuration-manager');
      const { createProvider } = require('../src/providers');
      
      ConfigurationManager.create = jest.fn().mockResolvedValue({
        getAvailableModels: jest.fn().mockReturnValue([]),
        getCategories: jest.fn().mockReturnValue({}),
        getConfiguration: jest.fn().mockReturnValue({
          models: {
            enhancers: [
              { name: 'test-enhancer', provider: 'test-provider', enabled: true, cost_per_token: 0.001, max_tokens: 4096, priority: 1 }
            ],
            classifiers: [],
            fallback_models: []
          },
          user_preferences: { max_cost_per_request: 0.1, prioritize_speed: false, enable_caching: true, quality_over_cost: false },
          providers: [
            { name: 'test-provider', api_key: 'test-key', models: [] }
          ]
        }),
        getCacheSettings: jest.fn().mockReturnValue({ ttl: 3600, max_size: 1000 })
      });

      createProvider.mockImplementation(() => {
        throw new Error('Provider initialization failed');
      });

      // Should not throw despite provider initialization failure
      await expect(PromptEnhancerMCPServer.create()).resolves.toBeInstanceOf(PromptEnhancerMCPServer);
    });

    it('should handle missing enhancement provider', async () => {
      const { ConfigurationManager } = require('../src/config/configuration-manager');
      
      ConfigurationManager.create = jest.fn().mockResolvedValue({
        getAvailableModels: jest.fn().mockReturnValue([]),
        getCategories: jest.fn().mockReturnValue({}),
        getConfiguration: jest.fn().mockReturnValue({
          models: {
            enhancers: [
              { name: 'test-enhancer', provider: 'test-provider', enabled: true, cost_per_token: 0.001, max_tokens: 4096, priority: 1 }
            ],
            classifiers: [],
            fallback_models: []
          },
          user_preferences: { max_cost_per_request: 0.1, prioritize_speed: false, enable_caching: true, quality_over_cost: false },
          providers: []
        }),
        getCacheSettings: jest.fn().mockReturnValue({ ttl: 3600, max_size: 1000 })
      });

      // Should handle gracefully when no enhancement provider is available
      await expect(PromptEnhancerMCPServer.create()).resolves.toBeInstanceOf(PromptEnhancerMCPServer);
    });
  });

  describe('edge cases', () => {
    it('should handle empty configuration', async () => {
      const { ConfigurationManager } = require('../src/config/configuration-manager');
      const { createProvider } = require('../src/providers');
      
      // Mock a provider
      const mockProvider = {
        name: 'test-provider',
        generate: jest.fn(),
        isAvailable: jest.fn().mockReturnValue(true),
        getAvailableModels: jest.fn().mockReturnValue(['test-enhancer']),
        estimateTokens: jest.fn().mockReturnValue(100),
        estimateCost: jest.fn().mockReturnValue(0.001)
      };
      
      ConfigurationManager.create = jest.fn().mockResolvedValue({
        getAvailableModels: jest.fn().mockReturnValue([]),
        getCategories: jest.fn().mockReturnValue({}),
        getConfiguration: jest.fn().mockReturnValue({
          models: {
            enhancers: [
              { name: 'test-enhancer', provider: 'test-provider', enabled: true, cost_per_token: 0.001, max_tokens: 4096, priority: 1 }
            ],
            classifiers: [],
            fallback_models: []
          },
          user_preferences: { max_cost_per_request: 0.1, prioritize_speed: false, enable_caching: true, quality_over_cost: false },
          providers: [
            { name: 'test-provider', api_key: 'test-key', models: [] }
          ]
        }),
        getCacheSettings: jest.fn().mockReturnValue({ ttl: 3600, max_size: 1000 })
      });

      createProvider.mockReturnValue(mockProvider);
      server = await PromptEnhancerMCPServer.create();
      expect(server).toBeInstanceOf(PromptEnhancerMCPServer);
    });

    it('should handle null configuration manager', async () => {
      const { ConfigurationManager } = require('../src/config/configuration-manager');
      ConfigurationManager.create = jest.fn().mockResolvedValue(null);

      await expect(PromptEnhancerMCPServer.create()).rejects.toThrow();
    });
  });
}); 