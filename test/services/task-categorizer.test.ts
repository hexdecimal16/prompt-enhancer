import { TaskCategorizer } from '../../src/services/task-categorizer';
import { CategoryConfig, TaskCategory, ModelConfig, ProviderInterface } from '../../src/types';
import { TagLLMCategorizer } from '../../src/services/tag-llm-categorizer';

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/tag-llm-categorizer');

describe('TaskCategorizer', () => {
  let taskCategorizer: TaskCategorizer;
  let mockCategories: Record<string, CategoryConfig>;
  let mockProvider: jest.Mocked<ProviderInterface>;
  let mockModel: ModelConfig;
  let mockTagger: jest.Mocked<TagLLMCategorizer>;

  beforeEach(() => {
    mockCategories = {
      'code_generation': {
        name: 'Code Generation & Debugging',
        description: 'Generating, debugging, or optimizing code',
        keywords: ['code', 'function', 'debug', 'error'],
        system_prompt: 'You are an expert software engineer...',
        priority: 1,
        token_cost: 0.001,
        compatibility: ['gpt-4', 'claude-3'],
        confidence_threshold: 0.7
      },
      'translation': {
        name: 'Translation & Localization',
        description: 'Translating text between languages',
        keywords: ['translate', 'language', 'localization'],
        system_prompt: 'You are a professional translator...',
        priority: 2,
        token_cost: 0.0005,
        compatibility: ['gpt-3.5', 'gpt-4'],
        confidence_threshold: 0.8
      }
    };

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

    mockTagger = {
      categorize: jest.fn()
    } as any;

    (TagLLMCategorizer as jest.MockedClass<typeof TagLLMCategorizer>).mockImplementation(() => mockTagger);
  });

  describe('constructor', () => {
    it('should initialize without tagger configuration', () => {
      taskCategorizer = new TaskCategorizer(mockCategories);
      expect(taskCategorizer).toBeInstanceOf(TaskCategorizer);
    });

    it('should initialize with tagger configuration', () => {
      const taggerConfig = {
        provider: mockProvider,
        model: mockModel,
        tagMap: { code: ['code_generation'] }
      };

      taskCategorizer = new TaskCategorizer(mockCategories, taggerConfig);
      expect(TagLLMCategorizer).toHaveBeenCalledWith(mockProvider, mockModel, { code: ['code_generation'] });
    });
  });

  describe('categorizeTask', () => {
    describe('without tagger', () => {
      beforeEach(() => {
        taskCategorizer = new TaskCategorizer(mockCategories);
      });

      it('should return empty array when no tagger is configured', async () => {
        const result = await taskCategorizer.categorizeTask('Test prompt');
        expect(result).toEqual([]);
      });
    });

    describe('with tagger', () => {
      beforeEach(() => {
        const taggerConfig = {
          provider: mockProvider,
          model: mockModel,
          tagMap: { code: ['code_generation'] }
        };
        taskCategorizer = new TaskCategorizer(mockCategories, taggerConfig);
      });

      it('should return categorized tasks from tagger', async () => {
        const expectedCategories: TaskCategory[] = [
          {
            name: 'Code Generation & Debugging',
            confidence: 0.9,
            keywords_matched: ['code'],
            system_prompt: 'You are an expert software engineer...',
            priority: 1
          }
        ];

        mockTagger.categorize.mockResolvedValue(expectedCategories);

        const result = await taskCategorizer.categorizeTask('Write a function to sort array');
        
        expect(result).toEqual(expectedCategories);
        expect(mockTagger.categorize).toHaveBeenCalledWith('Write a function to sort array', mockCategories);
      });

      it('should return empty array when tagger throws error', async () => {
        mockTagger.categorize.mockRejectedValue(new Error('Tagger error'));

        const result = await taskCategorizer.categorizeTask('Test prompt');
        
        expect(result).toEqual([]);
      });
    });
  });

  describe('analyzeComplexity', () => {
    beforeEach(() => {
      taskCategorizer = new TaskCategorizer(mockCategories);
    });

    it('should analyze complexity for simple prompt', async () => {
      const prompt = 'Hello world';
      
      const result = await taskCategorizer.analyzeComplexity(prompt);

      expect(result.categories).toEqual([]);
      expect(result.complexity_score).toBeGreaterThanOrEqual(0);
      expect(result.complexity_score).toBeLessThanOrEqual(1);
      expect(result.recommended_model).toBeDefined();
      expect(result.estimated_cost).toBeGreaterThan(0);
      expect(result.confidence).toBe(0);
    });

    it('should analyze complexity for long prompt', async () => {
      const prompt = 'A'.repeat(1500); // Long prompt > 1000 chars
      
      const result = await taskCategorizer.analyzeComplexity(prompt);

      expect(result.complexity_score).toBeGreaterThan(0.3); // Should get length bonus
    });

    it('should analyze complexity for code-containing prompt', async () => {
      const prompt = 'Fix this code:\n```javascript\nfunction test() { return "hello"; }\n```';
      
      const result = await taskCategorizer.analyzeComplexity(prompt);

      expect(result.complexity_score).toBeGreaterThan(0.2); // Should get code block bonus
    });

    it('should analyze complexity for prompt with multiple questions', async () => {
      const prompt = 'What is JavaScript? How does it work? Where is it used?';
      
      const result = await taskCategorizer.analyzeComplexity(prompt);

      expect(result.complexity_score).toBeGreaterThan(0.15); // Should get multiple questions bonus
    });

    it('should analyze complexity for prompt with special characters', async () => {
      const prompt = 'Test with special chars: {}[]()<>|&^%$#@!~`';
      
      const result = await taskCategorizer.analyzeComplexity(prompt);

      expect(result.complexity_score).toBeGreaterThan(0.1); // Should get special chars bonus
    });

    it('should recommend appropriate model based on complexity', async () => {
      // High complexity prompt
      const complexPrompt = 'A'.repeat(1500) + '\n```javascript\ncomplex code\n```';
      
      const result = await taskCategorizer.analyzeComplexity(complexPrompt);

      expect(result.recommended_model.name).toBe('gpt-4o'); // High complexity should recommend GPT-4
    });

    it('should recommend medium model for medium complexity', async () => {
      const mediumPrompt = 'A'.repeat(600); // Medium length
      
      const result = await taskCategorizer.analyzeComplexity(mediumPrompt);

      expect(result.recommended_model.name).toBe('claude-3.5-sonnet'); // Medium complexity
    });

    it('should recommend light model for low complexity', async () => {
      const simplePrompt = 'Hello';
      
      const result = await taskCategorizer.analyzeComplexity(simplePrompt);

      expect(result.recommended_model.name).toBe('gpt-4o-mini'); // Low complexity
    });

    it('should handle prompts with multiple categories', async () => {
      const taggerConfig = {
        provider: mockProvider,
        model: mockModel,
        tagMap: { code: ['code_generation'], translate: ['translation'] }
      };
      taskCategorizer = new TaskCategorizer(mockCategories, taggerConfig);

      const mockCategoriesForTest: TaskCategory[] = [
        {
          name: 'Code Generation & Debugging',
          confidence: 0.8,
          keywords_matched: ['code'],
          system_prompt: 'You are an expert software engineer...',
          priority: 1
        },
        {
          name: 'Translation & Localization', 
          confidence: 0.7,
          keywords_matched: ['translate'],
          system_prompt: 'You are a professional translator...',
          priority: 2
        },
        {
          name: 'Extra Category',
          confidence: 0.6,
          keywords_matched: [],
          system_prompt: 'Extra...',
          priority: 3
        }
      ];

      mockTagger.categorize.mockResolvedValue(mockCategoriesForTest);

      const result = await taskCategorizer.analyzeComplexity('Code and translate');

      expect(result.categories).toHaveLength(3);
      expect(result.complexity_score).toBeGreaterThan(0.15); // Should get multiple categories bonus
    });
  });

  describe('recommendModel', () => {
    beforeEach(() => {
      taskCategorizer = new TaskCategorizer(mockCategories);
    });

    it('should recommend GPT-4 for code-related tasks', async () => {
      const codeCategories: TaskCategory[] = [
        {
          name: 'Code Generation & Debugging',
          confidence: 0.9,
          keywords_matched: ['code'],
          system_prompt: 'You are an expert software engineer...',
          priority: 1
        }
      ];

      const taggerConfig = {
        provider: mockProvider,
        model: mockModel,
        tagMap: { code: ['code_generation'] }
      };
      taskCategorizer = new TaskCategorizer(mockCategories, taggerConfig);
      mockTagger.categorize.mockResolvedValue(codeCategories);

      const result = await taskCategorizer.analyzeComplexity('Write code');

      expect(result.recommended_model.name).toBe('gpt-4o');
    });
  });

  describe('estimateCost', () => {
    beforeEach(() => {
      taskCategorizer = new TaskCategorizer(mockCategories);
    });

    it('should estimate cost based on prompt length and complexity', async () => {
      const shortPrompt = 'Short';
      const longPrompt = 'A'.repeat(1000);

      const shortResult = await taskCategorizer.analyzeComplexity(shortPrompt);
      const longResult = await taskCategorizer.analyzeComplexity(longPrompt);

      expect(longResult.estimated_cost).toBeGreaterThan(shortResult.estimated_cost);
    });

    it('should factor in complexity for cost estimation', async () => {
      const simplePrompt = 'Hello';
      const complexPrompt = 'Hello ```code``` multiple? questions? with special chars: {}';

      const simpleResult = await taskCategorizer.analyzeComplexity(simplePrompt);
      const complexResult = await taskCategorizer.analyzeComplexity(complexPrompt);

      expect(complexResult.estimated_cost).toBeGreaterThan(simpleResult.estimated_cost);
    });
  });

  describe('edge cases', () => {
    it('should handle empty prompt', async () => {
      taskCategorizer = new TaskCategorizer(mockCategories);
      
      const result = await taskCategorizer.analyzeComplexity('');

      expect(result.complexity_score).toBeGreaterThanOrEqual(0);
      expect(result.estimated_cost).toBeGreaterThan(0);
    });

    it('should handle prompt with only whitespace', async () => {
      taskCategorizer = new TaskCategorizer(mockCategories);
      
      const result = await taskCategorizer.analyzeComplexity('   \n  \t  ');

      expect(result.complexity_score).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long prompt', async () => {
      taskCategorizer = new TaskCategorizer(mockCategories);
      const veryLongPrompt = 'A'.repeat(10000);
      
      const result = await taskCategorizer.analyzeComplexity(veryLongPrompt);

      expect(result.complexity_score).toBeLessThanOrEqual(1.0); // Should be capped at 1.0
    });

    it('should handle prompt with unicode characters', async () => {
      taskCategorizer = new TaskCategorizer(mockCategories);
      
      const result = await taskCategorizer.analyzeComplexity('🚀 Hello 世界 🌍');

      expect(result.complexity_score).toBeGreaterThanOrEqual(0);
    });

    it('should handle categories with missing confidence', async () => {
      const taggerConfig = {
        provider: mockProvider,
        model: mockModel,
        tagMap: { code: ['code_generation'] }
      };
      taskCategorizer = new TaskCategorizer(mockCategories, taggerConfig);

      const categoriesWithoutConfidence: TaskCategory[] = [];
      mockTagger.categorize.mockResolvedValue(categoriesWithoutConfidence);

      const result = await taskCategorizer.analyzeComplexity('Test');

      expect(result.confidence).toBe(0);
    });
  });
}); 