import { BaseProvider, TokenEstimator, ProviderRegistry } from '../../src/providers/base-provider';
import { LLMResponse, GenerationOptions, ModelConfig } from '../../src/types';

// Mock Logger
jest.mock('../../src/utils/logger');

// Concrete implementation of BaseProvider for testing
class TestProvider extends BaseProvider {
  get name(): string {
    return 'test-provider';
  }

  async generate(prompt: string, options: GenerationOptions): Promise<LLMResponse> {
    const response: LLMResponse = {
      content: `Response to: ${prompt}`,
      tokens_used: {
        input: this.estimateTokens(prompt),
        output: 50,
        total: this.estimateTokens(prompt) + 50
      },
      cost: 0.001,
      model: options.model || 'test-model',
      provider: this.name,
      processing_time: 100,
      cached: false
    };
    
    this.logUsage(response);
    return response;
  }

  estimateTokens(text: string): number {
    return TokenEstimator.estimateTokens(text);
  }

  // Expose protected method for testing
  public testHandleError(error: any, context: string): never {
    return this.handleError(error, context);
  }

  // Expose protected method for testing
  public testGetModelConfig(modelName: string): ModelConfig | undefined {
    return this.getModelConfig(modelName);
  }
}

describe('BaseProvider', () => {
  let provider: TestProvider;
  let mockModels: ModelConfig[];

  beforeEach(() => {
    mockModels = [
      {
        name: 'test-model-1',
        provider: 'test-provider',
        enabled: true,
        cost_per_token: 0.00001,
        max_tokens: 4096,
        priority: 1
      },
      {
        name: 'test-model-2',
        provider: 'test-provider',
        enabled: false,
        cost_per_token: 0.00002,
        max_tokens: 8192,
        priority: 2
      },
      {
        name: 'test-model-3',
        provider: 'test-provider',
        enabled: true,
        cost_per_token: 0.00003,
        max_tokens: 2048,
        priority: 3
      }
    ];

    provider = new TestProvider('test-provider', 'test-api-key', mockModels);
  });

  describe('constructor', () => {
    it('should initialize with provided parameters', () => {
      expect(provider.name).toBe('test-provider');
      expect(provider.isAvailable()).toBe(true);
    });

    it('should initialize with base URL', () => {
      const providerWithUrl = new TestProvider('test-provider', 'test-api-key', mockModels, 'https://api.test.com');
      expect(providerWithUrl.isAvailable()).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key and models are available', () => {
      expect(provider.isAvailable()).toBe(true);
    });

    it('should return false when no API key is provided', () => {
      const providerNoKey = new TestProvider('test-provider', '', mockModels);
      expect(providerNoKey.isAvailable()).toBe(false);
    });

    it('should return false when no models are provided', () => {
      const providerNoModels = new TestProvider('test-provider', 'test-api-key', []);
      expect(providerNoModels.isAvailable()).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return only enabled models', () => {
      const availableModels = provider.getAvailableModels();
      expect(availableModels).toEqual(['test-model-1', 'test-model-3']);
      expect(availableModels).not.toContain('test-model-2');
    });

    it('should return empty array when no models are enabled', () => {
      const disabledModels = mockModels.map(m => ({ ...m, enabled: false }));
      const providerNoEnabled = new TestProvider('test-provider', 'test-api-key', disabledModels);
      expect(providerNoEnabled.getAvailableModels()).toEqual([]);
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost correctly with default model', () => {
      const cost = provider.estimateCost(100, 50);
      expect(cost).toBe((100 + 50) * 0.00001);
    });

    it('should calculate cost correctly with specified model', () => {
      const cost = provider.estimateCost(100, 50, 'test-model-3');
      expect(cost).toBe((100 + 50) * 0.00003);
    });

    it('should return 0 when model is not found', () => {
      const cost = provider.estimateCost(100, 50, 'non-existent-model');
      expect(cost).toBe(0);
    });

    it('should use first model when no model name is specified', () => {
      const cost = provider.estimateCost(100, 50);
      expect(cost).toBe((100 + 50) * mockModels[0].cost_per_token);
    });
  });

  describe('getModelConfig', () => {
    it('should return model config for enabled model', () => {
      const config = provider.testGetModelConfig('test-model-1');
      expect(config).toEqual(mockModels[0]);
    });

    it('should return undefined for disabled model', () => {
      const config = provider.testGetModelConfig('test-model-2');
      expect(config).toBeUndefined();
    });

    it('should return undefined for non-existent model', () => {
      const config = provider.testGetModelConfig('non-existent');
      expect(config).toBeUndefined();
    });
  });

  describe('generate', () => {
    it('should generate response and log usage', async () => {
      const prompt = 'Test prompt';
      const options: GenerationOptions = { model: 'test-model-1', max_tokens: 100 };
      
      const response = await provider.generate(prompt, options);
      
      expect(response.content).toBe(`Response to: ${prompt}`);
      expect(response.model).toBe('test-model-1');
      expect(response.provider).toBe('test-provider');
      expect(response.cached).toBe(false);
    });
  });

  describe('handleError', () => {
    it('should throw error with provider context', () => {
      const originalError = new Error('Original error');
      
      expect(() => {
        provider.testHandleError(originalError, 'test context');
      }).toThrow('test-provider provider error: Original error');
    });

    it('should handle error object without message', () => {
      const errorObj = { code: 500 };
      
      expect(() => {
        provider.testHandleError(errorObj, 'test context');
      }).toThrow('test-provider provider error: [object Object]');
    });

    it('should handle string error', () => {
      expect(() => {
        provider.testHandleError('String error', 'test context');
      }).toThrow('test-provider provider error: String error');
    });
  });
});

describe('TokenEstimator', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens correctly for short text', () => {
      const text = 'Hello world';
      const tokens = TokenEstimator.estimateTokens(text);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should estimate tokens correctly for long text', () => {
      const text = 'A'.repeat(1000);
      const tokens = TokenEstimator.estimateTokens(text);
      expect(tokens).toBe(250);
    });

    it('should return minimum of 1 token for empty string', () => {
      const tokens = TokenEstimator.estimateTokens('');
      expect(tokens).toBe(1);
    });

    it('should handle unicode characters', () => {
      const text = '🚀 Hello 世界';
      const tokens = TokenEstimator.estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('estimateTokensByType', () => {
    const sampleText = 'function test() { return "hello"; }';

    it('should increase tokens for code content', () => {
      const baseTokens = TokenEstimator.estimateTokens(sampleText);
      const codeTokens = TokenEstimator.estimateTokensByType(sampleText, 'code');
      expect(codeTokens).toBe(Math.ceil(baseTokens * 1.3));
    });

    it('should decrease tokens for structured content', () => {
      const baseTokens = TokenEstimator.estimateTokens(sampleText);
      const structuredTokens = TokenEstimator.estimateTokensByType(sampleText, 'structured');
      expect(structuredTokens).toBe(Math.ceil(baseTokens * 0.8));
    });

    it('should return base tokens for prose content', () => {
      const baseTokens = TokenEstimator.estimateTokens(sampleText);
      const proseTokens = TokenEstimator.estimateTokensByType(sampleText, 'prose');
      expect(proseTokens).toBe(baseTokens);
    });

    it('should handle default case', () => {
      const baseTokens = TokenEstimator.estimateTokens(sampleText);
      const defaultTokens = TokenEstimator.estimateTokensByType(sampleText, 'prose');
      expect(defaultTokens).toBe(baseTokens);
    });
  });
});

describe('ProviderRegistry', () => {
  const mockFactory = {
    createProvider: jest.fn()
  };

  beforeEach(() => {
    // Clear registry
    ProviderRegistry['providers'].clear();
    mockFactory.createProvider.mockClear();
  });

  describe('register', () => {
    it('should register provider factory', () => {
      ProviderRegistry.register('test-provider', mockFactory);
      expect(ProviderRegistry.getAvailableProviders()).toContain('test-provider');
    });
  });

  describe('create', () => {
    beforeEach(() => {
      ProviderRegistry.register('test-provider', mockFactory);
    });

    it('should create provider using registered factory', () => {
      const mockProvider = { name: 'test-provider' };
      mockFactory.createProvider.mockReturnValue(mockProvider);
      
      const result = ProviderRegistry.create('test-provider', { config: 'test' });
      
      expect(result).toBe(mockProvider);
      expect(mockFactory.createProvider).toHaveBeenCalledWith('test-provider', { config: 'test' });
    });

    it('should return null for unregistered provider', () => {
      const result = ProviderRegistry.create('non-existent', { config: 'test' });
      expect(result).toBeNull();
    });

    it('should return null when factory returns null', () => {
      mockFactory.createProvider.mockReturnValue(null);
      
      const result = ProviderRegistry.create('test-provider', { config: 'test' });
      expect(result).toBeNull();
    });
  });

  describe('getAvailableProviders', () => {
    it('should return empty array when no providers registered', () => {
      expect(ProviderRegistry.getAvailableProviders()).toEqual([]);
    });

    it('should return all registered provider names', () => {
      ProviderRegistry.register('provider1', mockFactory);
      ProviderRegistry.register('provider2', mockFactory);
      
      const providers = ProviderRegistry.getAvailableProviders();
      expect(providers).toContain('provider1');
      expect(providers).toContain('provider2');
      expect(providers).toHaveLength(2);
    });
  });
}); 