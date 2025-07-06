import { TagLLMCategorizer, TagMap } from '../../src/services/tag-llm-categorizer';
import { ProviderInterface, ModelConfig, CategoryConfig, LLMResponse } from '../../src/types';

// Mock dependencies
jest.mock('../../src/utils/logger');

describe('TagLLMCategorizer', () => {
  let tagCategorizer: TagLLMCategorizer;
  let mockProvider: jest.Mocked<ProviderInterface>;
  let mockModel: ModelConfig;
  let mockTagMap: TagMap;
  let mockCategories: Record<string, CategoryConfig>;

  beforeEach(() => {
    mockProvider = {
      name: 'test-provider',
      isAvailable: jest.fn().mockReturnValue(true),
      generate: jest.fn(),
      estimateTokens: jest.fn().mockReturnValue(20),
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

    mockTagMap = {
      code: ['code_generation', 'technical_documentation'],
      math: ['problem_solving'],
      translate: ['translation'],
      terminal: ['linux_terminal'],
      role: ['role_play']
    };

    mockCategories = {
      'code_generation': {
        name: 'Code Generation & Debugging',
        description: 'Generating, debugging, or optimizing code',
        keywords: ['code', 'function', 'debug'],
        system_prompt: 'You are an expert software engineer...',
        priority: 1,
        token_cost: 0.001,
        compatibility: ['gpt-4'],
        confidence_threshold: 0.7
      },
      'translation': {
        name: 'Translation & Localization',
        description: 'Translating text between languages',
        keywords: ['translate', 'language'],
        system_prompt: 'You are a professional translator...',
        priority: 2,
        token_cost: 0.0005,
        compatibility: ['gpt-3.5'],
        confidence_threshold: 0.8
      },
      'linux_terminal': {
        name: 'Linux Terminal Simulation',
        description: 'Simulating Linux terminal behavior',
        keywords: ['terminal', 'linux', 'command'],
        system_prompt: 'You are a Linux terminal...',
        priority: 3,
        token_cost: 0.0008,
        compatibility: ['gpt-4'],
        confidence_threshold: 0.6
      }
    };

    tagCategorizer = new TagLLMCategorizer(mockProvider, mockModel, mockTagMap);
  });

  describe('constructor', () => {
    it('should initialize with provider, model, and tag map', () => {
      expect(tagCategorizer).toBeInstanceOf(TagLLMCategorizer);
    });
  });

  describe('categorize', () => {
    beforeEach(() => {
      const mockResponse: LLMResponse = {
        content: 'code, translate',
        tokens_used: { input: 30, output: 5, total: 35 },
        cost: 0.001,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 150,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(mockResponse);
    });

    it('should categorize prompt and return matching categories', async () => {
      const prompt = 'Write a function to translate text';
      
      const result = await tagCategorizer.categorize(prompt, mockCategories);

      expect(result).toHaveLength(2); // Should match code and translate
      expect(result.some(cat => cat.name === 'Code Generation & Debugging')).toBe(true);
      expect(result.some(cat => cat.name === 'Translation & Localization')).toBe(true);
    });

    it('should handle single tag response', async () => {
      const singleTagResponse: LLMResponse = {
        content: 'code',
        tokens_used: { input: 20, output: 3, total: 23 },
        cost: 0.0005,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 100,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(singleTagResponse);

      const result = await tagCategorizer.categorize('Debug this function', mockCategories);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Code Generation & Debugging');
    });

    it('should handle no matching tags', async () => {
      const noMatchResponse: LLMResponse = {
        content: 'unknown, unmatched',
        tokens_used: { input: 15, output: 10, total: 25 },
        cost: 0.0003,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 80,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(noMatchResponse);

      const result = await tagCategorizer.categorize('Random prompt', mockCategories);

      expect(result).toHaveLength(0);
    });

    it('should handle empty response', async () => {
      const emptyResponse: LLMResponse = {
        content: '',
        tokens_used: { input: 10, output: 0, total: 10 },
        cost: 0.0001,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 50,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(emptyResponse);

      const result = await tagCategorizer.categorize('Empty response test', mockCategories);

      expect(result).toHaveLength(0);
    });

    it('should handle response with whitespace and special characters', async () => {
      const messyResponse: LLMResponse = {
        content: '  code,  translate  ,  math  ',
        tokens_used: { input: 25, output: 15, total: 40 },
        cost: 0.001,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 120,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(messyResponse);

      const result = await tagCategorizer.categorize('Messy response test', mockCategories);

      expect(result).toHaveLength(2); // code and translate should be found
    });

    it('should calculate confidence scores correctly', async () => {
      const result = await tagCategorizer.categorize('Code translation task', mockCategories);

      result.forEach(category => {
        expect(category.confidence).toBeGreaterThan(0);
        expect(category.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should include matched keywords in result', async () => {
      const result = await tagCategorizer.categorize('Write code', mockCategories);

      const codeCategory = result.find(cat => cat.name === 'Code Generation & Debugging');
      expect(codeCategory?.keywords_matched).toContain('code');
    });

    it('should sort categories by confidence (descending)', async () => {
      // Set up response that matches multiple categories
      const multiMatchResponse: LLMResponse = {
        content: 'code, translate, terminal',
        tokens_used: { input: 30, output: 12, total: 42 },
        cost: 0.001,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 140,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(multiMatchResponse);

      const result = await tagCategorizer.categorize('Multi-category prompt', mockCategories);

      // Should be sorted by confidence in descending order
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].confidence).toBeGreaterThanOrEqual(result[i + 1].confidence);
      }
    });

    it('should handle provider errors gracefully', async () => {
      mockProvider.generate.mockRejectedValue(new Error('API Error'));

      const result = await tagCategorizer.categorize('Error test', mockCategories);

      expect(result).toHaveLength(0);
    });

    it('should handle long prompts', async () => {
      const longPrompt = 'A'.repeat(5000);
      
      const result = await tagCategorizer.categorize(longPrompt, mockCategories);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty categories', async () => {
      const result = await tagCategorizer.categorize('Test prompt', {});

      expect(result).toHaveLength(0);
    });
  });

  describe('createTaggingPrompt', () => {
    it('should create proper tagging prompt with all available tags', async () => {
      // Verify the prompt is created by checking the provider was called
      await tagCategorizer.categorize('Test prompt', mockCategories);

      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.stringContaining('Available tags:'),
        expect.objectContaining({
          model: 'test-model',
          max_tokens: 50,
          temperature: 0
        })
      );
    });

    it('should include prompt in tagging request', async () => {
      const testPrompt = 'Unique test prompt for verification';
      
      await tagCategorizer.categorize(testPrompt, mockCategories);

      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.stringContaining(testPrompt),
        expect.any(Object)
      );
    });
  });

  describe('extractTags', () => {
    it('should extract tags from various response formats', async () => {
      const testCases = [
        'code, translate',
        'code,translate',
        'code; translate',
        'code | translate',
        'Tags: code, translate',
        'code\ntranslate'
      ];

      for (const content of testCases) {
        const response: LLMResponse = {
          content,
          tokens_used: { input: 20, output: content.length / 4, total: 20 + content.length / 4 },
          cost: 0.001,
          model: 'test-model',
          provider: 'test-provider',
          processing_time: 100,
          cached: false
        };
        mockProvider.generate.mockResolvedValue(response);

        const result = await tagCategorizer.categorize('Test prompt', mockCategories);
        
        // Should find at least the code category
        expect(result.some(cat => cat.name === 'Code Generation & Debugging')).toBe(true);
      }
    });
  });

  describe('mapTagsToCategories', () => {
    it('should map tags to correct categories using tag map', async () => {
      const terminalResponse: LLMResponse = {
        content: 'terminal',
        tokens_used: { input: 20, output: 5, total: 25 },
        cost: 0.001,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 100,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(terminalResponse);

      const result = await tagCategorizer.categorize('Act as Linux terminal', mockCategories);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Linux Terminal Simulation');
    });

    it('should handle tags not in tag map', async () => {
      const unknownTagResponse: LLMResponse = {
        content: 'unknown_tag',
        tokens_used: { input: 20, output: 5, total: 25 },
        cost: 0.001,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 100,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(unknownTagResponse);

      const result = await tagCategorizer.categorize('Unknown tag test', mockCategories);

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate different confidence scores for different categories', async () => {
      const multiResponse: LLMResponse = {
        content: 'code, translate',
        tokens_used: { input: 30, output: 8, total: 38 },
        cost: 0.001,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 120,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(multiResponse);

      const result = await tagCategorizer.categorize('Code and translate', mockCategories);

      // Different categories may have different confidence scores
      expect(result).toHaveLength(2);
      const confidences = result.map(cat => cat.confidence);
      expect(confidences.every(conf => conf > 0 && conf <= 1)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty prompt', async () => {
      const result = await tagCategorizer.categorize('', mockCategories);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle prompt with only whitespace', async () => {
      const result = await tagCategorizer.categorize('   \n\t  ', mockCategories);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle unicode characters in prompt', async () => {
      const result = await tagCategorizer.categorize('🚀 Hello 世界', mockCategories);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle categories with missing properties', async () => {
      const incompleteCategories = {
        'incomplete': {
          name: 'Incomplete Category',
          description: 'Missing some properties',
          keywords: ['incomplete'],
          system_prompt: 'Test',
          priority: 1,
          token_cost: 0.001,
          compatibility: [],
          confidence_threshold: 0.5
        }
      };

      const result = await tagCategorizer.categorize('Test', incompleteCategories);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle very long category lists', async () => {
      const manyCategories: Record<string, CategoryConfig> = {};
      
      for (let i = 0; i < 100; i++) {
        manyCategories[`category_${i}`] = {
          name: `Category ${i}`,
          description: `Description ${i}`,
          keywords: [`keyword${i}`],
          system_prompt: `System prompt ${i}`,
          priority: i,
          token_cost: 0.001,
          compatibility: [],
          confidence_threshold: 0.5
        };
      }

      const result = await tagCategorizer.categorize('Test with many categories', manyCategories);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle provider returning very long response', async () => {
      const longResponse: LLMResponse = {
        content: 'code, '.repeat(1000) + 'translate',
        tokens_used: { input: 20, output: 2000, total: 2020 },
        cost: 0.01,
        model: 'test-model',
        provider: 'test-provider',
        processing_time: 500,
        cached: false
      };
      mockProvider.generate.mockResolvedValue(longResponse);

      const result = await tagCategorizer.categorize('Long response test', mockCategories);

      expect(Array.isArray(result)).toBe(true);
    });
  });
}); 