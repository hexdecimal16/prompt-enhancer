import { PromptEnhancer, EnhancementOptions } from '../../src/services/prompt-enhancer';
import { ProviderInterface, ModelConfig, TaskCategory, LLMResponse } from '../../src/types';

// Mock dependencies
jest.mock('../../src/utils/logger');

describe('PromptEnhancer', () => {
  let promptEnhancer: PromptEnhancer;
  let mockProvider: jest.Mocked<ProviderInterface>;
  let mockModel: ModelConfig;

  beforeEach(() => {
    mockProvider = {
      name: 'test-provider',
      isAvailable: jest.fn().mockReturnValue(true),
      generate: jest.fn(),
      estimateTokens: jest.fn().mockReturnValue(25),
      estimateCost: jest.fn().mockReturnValue(0.001),
      getAvailableModels: jest.fn().mockReturnValue(['test-model'])
    };

    mockModel = {
      name: 'test-model',
      provider: 'test-provider',
      enabled: true,
      cost_per_token: 0.00001,
      max_tokens: 4096,
      priority: 1
    };

    promptEnhancer = new PromptEnhancer(mockProvider, mockModel);
  });

  describe('constructor', () => {
    it('should initialize with provider and model', () => {
      expect(promptEnhancer).toBeInstanceOf(PromptEnhancer);
    });
  });

  describe('enhancePrompt', () => {
    const mockCategories: TaskCategory[] = [
      {
        name: 'Code Generation & Debugging',
        confidence: 0.9,
        keywords_matched: ['code'],
        system_prompt: 'You are an expert software engineer...',
        priority: 1
      }
    ];

    beforeEach(() => {
      const mockResponse: LLMResponse = {
        content: 'Enhanced: Write a comprehensive function to sort an array with proper error handling and documentation.',
        tokens_used: { input: 50, output: 75, total: 125 },
        cost: 0.005,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 200,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(mockResponse);
    });

    it('should enhance prompt with default options', async () => {
      const originalPrompt = 'Write a function to sort array';
      
      const result = await promptEnhancer.enhancePrompt(originalPrompt, mockCategories);

      expect(result.original_prompt).toBe(originalPrompt);
      expect(result.enhanced_prompt).toBe('Write a comprehensive function to sort an array with proper error handling and documentation.');
      expect(result.categories).toEqual(mockCategories);
      expect(result.model_used).toBe('test-model');
      expect(result.provider).toBe('test-provider');
      expect(result.processing_time).toBeGreaterThan(0);
    });

    it('should enhance prompt with custom options', async () => {
      const options: EnhancementOptions = {
        max_iterations: 3,
        strategies: ['clarity', 'specificity'],
        quality_threshold: 0.9,
        cost_limit: 0.02
      };

      const result = await promptEnhancer.enhancePrompt('Test prompt', mockCategories, options);

      expect(result.enhancement_strategies).toContain('clarity');
      expect(result.estimated_cost).toBeLessThanOrEqual(0.02);
    });

    it('should return original prompt when no categories provided', async () => {
      const originalPrompt = 'Test prompt';
      
      const result = await promptEnhancer.enhancePrompt(originalPrompt, []);

      expect(result.original_prompt).toBe(originalPrompt);
      expect(result.enhanced_prompt).toBe(originalPrompt);
      expect(result.categories).toEqual([]);
    });

    it('should return original prompt when no strategies provided', async () => {
      const originalPrompt = 'Test prompt';
      const options: EnhancementOptions = {
        strategies: []
      };
      
      const result = await promptEnhancer.enhancePrompt(originalPrompt, mockCategories, options);

      expect(result.enhanced_prompt).toBe(originalPrompt);
    });

    it('should handle multiple enhancement iterations', async () => {
      const options: EnhancementOptions = {
        max_iterations: 2,
        strategies: ['clarity', 'specificity'],
        cost_limit: 0.02
      };

      const result = await promptEnhancer.enhancePrompt('Test prompt', mockCategories, options);

      expect(mockProvider.generate).toHaveBeenCalledTimes(2);
      expect(result.enhancement_strategies).toHaveLength(2);
    });

    it('should stop enhancement when cost limit is reached', async () => {
      const expensiveResponse: LLMResponse = {
        content: 'Enhanced prompt',
        tokens_used: { input: 50, output: 75, total: 125 },
        cost: 0.015, // High cost
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 200,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(expensiveResponse);

      const options: EnhancementOptions = {
        max_iterations: 3,
        cost_limit: 0.02 // Low limit
      };

      const result = await promptEnhancer.enhancePrompt('Test prompt', mockCategories, options);

      expect(result.estimated_cost).toBeLessThanOrEqual(0.02);
    });

    it('should handle enhancement errors gracefully', async () => {
      mockProvider.generate.mockRejectedValueOnce(new Error('API Error'));

      const result = await promptEnhancer.enhancePrompt('Test prompt', mockCategories);

      // Should still return a result, possibly with original prompt
      expect(result).toBeDefined();
      expect(result.original_prompt).toBe('Test prompt');
    });

    it('should stop when quality threshold is reached', async () => {
      const options: EnhancementOptions = {
        max_iterations: 3,
        quality_threshold: 0.4 // Low threshold to trigger early stop
      };

      const result = await promptEnhancer.enhancePrompt('Test prompt', mockCategories, options);

      expect(result.quality_score).toBeGreaterThanOrEqual(0.4);
    });
  });

  describe('createEnhancementPrompt', () => {
    it('should create proper enhancement prompts for different strategies', async () => {
      const category: TaskCategory = {
        name: 'Code Generation',
        confidence: 0.9,
        keywords_matched: ['code'],
        system_prompt: 'You are an expert software engineer with deep knowledge...',
        priority: 1
      };

      // Test different strategies by triggering enhancement
      const strategies = ['clarity', 'specificity', 'context_enrichment', 'structure', 'examples', 'constraints'];
      
      for (const strategy of strategies) {
        const options: EnhancementOptions = {
          strategies: [strategy],
          max_iterations: 1
        };

        await promptEnhancer.enhancePrompt('Test prompt', [category], options);
        
        // Verify the provider was called (indicating strategy was processed)
        expect(mockProvider.generate).toHaveBeenCalled();
      }
    });
  });

  describe('getStrategyInstructions', () => {
    it('should provide instructions for all strategies', async () => {
      const strategies = ['clarity', 'specificity', 'context_enrichment', 'structure', 'examples', 'constraints'];
      
      for (const strategy of strategies) {
        const options: EnhancementOptions = {
          strategies: [strategy],
          max_iterations: 1
        };

        await promptEnhancer.enhancePrompt('Test prompt', [{
          name: 'Test Category',
          confidence: 0.8,
          keywords_matched: [],
          system_prompt: 'Test system prompt',
          priority: 1
        }], options);

        expect(mockProvider.generate).toHaveBeenCalled();
      }
    });

    it('should handle unknown strategy', async () => {
      const options: EnhancementOptions = {
        strategies: ['unknown_strategy'],
        max_iterations: 1
      };

      const result = await promptEnhancer.enhancePrompt('Test prompt', [{
        name: 'Test Category',
        confidence: 0.8,
        keywords_matched: [],
        system_prompt: 'Test system prompt',
        priority: 1
      }], options);

      expect(result).toBeDefined();
    });
  });

  describe('extractEnhancedPrompt', () => {
    it('should extract prompt from various response formats', async () => {
      const testResponses = [
        'Enhanced prompt: This is the enhanced version',
        'Here is the enhanced prompt: This is enhanced',
        'Enhanced version: This is enhanced',
        'Improved prompt: This is enhanced',
        'This is just a plain response'
      ];

      for (const content of testResponses) {
        const mockResponse: LLMResponse = {
          content,
          tokens_used: { input: 20, output: 30, total: 50 },
          cost: 0.001,
          model: 'test-model',
          provider: 'test-provider',
          processing_time: 100,
          cached: false
        };
        mockProvider.generate.mockResolvedValue(mockResponse);

        const result = await promptEnhancer.enhancePrompt('Test', [{
          name: 'Test',
          confidence: 0.8,
          keywords_matched: [],
          system_prompt: 'Test',
          priority: 1
        }]);

        expect(result.enhanced_prompt).toBeDefined();
        expect(typeof result.enhanced_prompt).toBe('string');
      }
    });
  });

  describe('batchEnhancePrompts', () => {
    it('should enhance multiple prompts', async () => {
      const prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3'];
      const categories = prompts.map(() => [{
        name: 'Test Category',
        confidence: 0.8,
        keywords_matched: [],
        system_prompt: 'Test',
        priority: 1
      }]);

      const results = await promptEnhancer.batchEnhancePrompts(prompts, categories);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.original_prompt).toBe(prompts[index]);
      });
    });

    it('should handle batch enhancement with options', async () => {
      const prompts = ['Prompt 1', 'Prompt 2'];
      const categories = prompts.map(() => [{
        name: 'Test Category',
        confidence: 0.8,
        keywords_matched: [],
        system_prompt: 'Test',
        priority: 1
      }]);
      const options: EnhancementOptions = {
        max_iterations: 1,
        strategies: ['clarity']
      };

      const results = await promptEnhancer.batchEnhancePrompts(prompts, categories, options);

      expect(results).toHaveLength(2);
    });

    it('should handle empty batch', async () => {
      const results = await promptEnhancer.batchEnhancePrompts([], []);
      expect(results).toEqual([]);
    });

    it('should handle mismatched prompts and categories arrays', async () => {
      const prompts = ['Prompt 1', 'Prompt 2'];
      const categories = [[{
        name: 'Test Category',
        confidence: 0.8,
        keywords_matched: [],
        system_prompt: 'Test',
        priority: 1
      }]]; // Only one category array for two prompts

      const results = await promptEnhancer.batchEnhancePrompts(prompts, categories);

      expect(results).toHaveLength(2);
    });
  });

  describe('getAvailableStrategies', () => {
    it('should return list of available strategies', () => {
      const strategies = promptEnhancer.getAvailableStrategies();
      
      expect(strategies).toContain('clarity');
      expect(strategies).toContain('specificity');
      expect(strategies).toContain('context_enrichment');
      expect(strategies).toContain('structure');
      expect(strategies).toContain('examples');
      expect(strategies).toContain('constraints');
    });
  });

  describe('updateEnhancementModel', () => {
    it('should update provider and model', () => {
      const newProvider: jest.Mocked<ProviderInterface> = {
        name: 'new-provider',
        isAvailable: jest.fn().mockReturnValue(true),
        generate: jest.fn(),
        estimateTokens: jest.fn().mockReturnValue(30),
        estimateCost: jest.fn().mockReturnValue(0.002),
        getAvailableModels: jest.fn().mockReturnValue(['new-model'])
      };

      const newModel: ModelConfig = {
        name: 'new-model',
        provider: 'new-provider',
        enabled: true,
        cost_per_token: 0.00002,
        max_tokens: 8192,
        priority: 1
      };

      promptEnhancer.updateEnhancementModel(newProvider, newModel);

      // The update should complete without error
      expect(() => promptEnhancer.updateEnhancementModel(newProvider, newModel)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle very long prompts', async () => {
      const longPrompt = 'A'.repeat(10000);
      
      const result = await promptEnhancer.enhancePrompt(longPrompt, [{
        name: 'Test Category',
        confidence: 0.8,
        keywords_matched: [],
        system_prompt: 'Test',
        priority: 1
      }]);

      expect(result.original_prompt).toBe(longPrompt);
    });

    it('should handle empty prompt', async () => {
      const result = await promptEnhancer.enhancePrompt('', [{
        name: 'Test Category',
        confidence: 0.8,
        keywords_matched: [],
        system_prompt: 'Test',
        priority: 1
      }]);

      expect(result.original_prompt).toBe('');
    });

    it('should handle unicode characters in prompt', async () => {
      const unicodePrompt = '🚀 Hello 世界 🌍';
      
      const result = await promptEnhancer.enhancePrompt(unicodePrompt, [{
        name: 'Test Category',
        confidence: 0.8,
        keywords_matched: [],
        system_prompt: 'Test',
        priority: 1
      }]);

      expect(result.original_prompt).toBe(unicodePrompt);
    });

    it('should handle provider token estimation failure', async () => {
      mockProvider.estimateTokens.mockImplementation(() => {
        throw new Error('Token estimation failed');
      });

      // Should still work despite token estimation failure
      const result = await promptEnhancer.enhancePrompt('Test prompt', [{
        name: 'Test Category',
        confidence: 0.8,
        keywords_matched: [],
        system_prompt: 'Test',
        priority: 1
      }]);

      expect(result).toBeDefined();
    });

    it('should handle category with very long system prompt', async () => {
      const categoryWithLongPrompt: TaskCategory = {
        name: 'Test Category',
        confidence: 0.8,
        keywords_matched: [],
        system_prompt: 'A'.repeat(10000),
        priority: 1
      };

      const result = await promptEnhancer.enhancePrompt('Test prompt', [categoryWithLongPrompt]);

      expect(result).toBeDefined();
    });

    it('should handle response with empty content', async () => {
      const emptyResponse: LLMResponse = {
        content: '',
        tokens_used: { input: 10, output: 0, total: 10 },
        cost: 0.001,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 100,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(emptyResponse);

      const result = await promptEnhancer.enhancePrompt('Test prompt', [{
        name: 'Test Category',
        confidence: 0.8,
        keywords_matched: [],
        system_prompt: 'Test',
        priority: 1
      }]);

      expect(result.enhanced_prompt).toBeDefined();
    });
  });
}); 