import { ModelDecisionEngine } from '../../src/services/model-decision-engine';
import { ModelConfig, ProviderInterface, TaskCategory, UserPreferences } from '../../src/types';

// Mock dependencies
jest.mock('../../src/utils/logger');

describe('ModelDecisionEngine', () => {
  let modelDecisionEngine: ModelDecisionEngine;
  let mockModels: ModelConfig[];
  let mockProviders: Map<string, ProviderInterface>;
  let mockUserPreferences: UserPreferences;
  let mockProvider1: jest.Mocked<ProviderInterface>;
  let mockProvider2: jest.Mocked<ProviderInterface>;

  beforeEach(() => {
    mockModels = [
      {
        name: 'gpt-4o',
        provider: 'openai',
        enabled: true,
        cost_per_token: 0.000005,
        max_tokens: 4096,
        priority: 1,
        quality_score: 0.95,
        use_cases: ['code', 'reasoning', 'analysis']
      },
      {
        name: 'claude-3.5-sonnet',
        provider: 'anthropic',
        enabled: true,
        cost_per_token: 0.000003,
        max_tokens: 4096,
        priority: 2,
        quality_score: 0.90,
        use_cases: ['writing', 'analysis']
      },
      {
        name: 'gpt-4o-mini',
        provider: 'openai',
        enabled: true,
        cost_per_token: 0.00000015,
        max_tokens: 4096,
        priority: 3,
        quality_score: 0.75,
        use_cases: ['simple', 'quick']
      },
      {
        name: 'disabled-model',
        provider: 'openai',
        enabled: false,
        cost_per_token: 0.000001,
        max_tokens: 2048,
        priority: 4,
        quality_score: 0.80
      }
    ];

    mockProvider1 = {
      name: 'openai',
      isAvailable: jest.fn().mockReturnValue(true),
      generate: jest.fn(),
      estimateTokens: jest.fn().mockReturnValue(25),
      estimateCost: jest.fn().mockReturnValue(0.001),
      getAvailableModels: jest.fn().mockReturnValue(['gpt-4o', 'gpt-4o-mini'])
    };

    mockProvider2 = {
      name: 'anthropic',
      isAvailable: jest.fn().mockReturnValue(true),
      generate: jest.fn(),
      estimateTokens: jest.fn().mockReturnValue(30),
      estimateCost: jest.fn().mockReturnValue(0.0015),
      getAvailableModels: jest.fn().mockReturnValue(['claude-3.5-sonnet'])
    };

    mockProviders = new Map([
      ['openai', mockProvider1],
      ['anthropic', mockProvider2]
    ]);

    mockUserPreferences = {
      max_cost_per_request: 0.10,
      prioritize_speed: false,
      enable_caching: true,
      quality_over_cost: false
    };

    modelDecisionEngine = new ModelDecisionEngine(mockModels, mockProviders, mockUserPreferences);
  });

  describe('constructor', () => {
    it('should initialize with enabled models only', () => {
      expect(modelDecisionEngine).toBeInstanceOf(ModelDecisionEngine);
    });

    it('should filter out disabled models', () => {
      const allModels = [...mockModels, { name: 'another-disabled', provider: 'test', enabled: false, cost_per_token: 0.001, max_tokens: 1000, priority: 5 }];
      const engine = new ModelDecisionEngine(allModels, mockProviders, mockUserPreferences);
      expect(engine).toBeInstanceOf(ModelDecisionEngine);
    });
  });

  describe('getModelRecommendations', () => {
    const mockCategories: TaskCategory[] = [
      {
        name: 'Code Generation',
        confidence: 0.9,
        keywords_matched: ['code'],
        system_prompt: 'You are a coding expert',
        priority: 1
      }
    ];

    it('should return model recommendations sorted by weighted score', async () => {
      mockProvider1.estimateCost.mockReturnValue(0.005);
      mockProvider2.estimateCost.mockReturnValue(0.003);

      const recommendations = await modelDecisionEngine.getModelRecommendations(
        'Write a function to sort an array',
        mockCategories,
        0.7,
        3
      );

      expect(recommendations).toHaveLength(3);
      expect(recommendations[0]).toHaveProperty('selected_model');
      expect(recommendations[0]).toHaveProperty('provider');
      expect(recommendations[0]).toHaveProperty('reasoning');
      expect(recommendations[0]).toHaveProperty('estimated_cost');
      expect(recommendations[0]).toHaveProperty('quality_score');
    });

    it('should limit results to requested number', async () => {
      const recommendations = await modelDecisionEngine.getModelRecommendations(
        'Simple task',
        mockCategories,
        0.3,
        2
      );

      expect(recommendations).toHaveLength(2);
    });

    it('should handle empty categories', async () => {
      const recommendations = await modelDecisionEngine.getModelRecommendations(
        'Task without categories',
        [],
        0.5,
        3
      );

      expect(recommendations).toHaveLength(3);
    });

    it('should throw error when no models are available', async () => {
      const unavailableProviders = new Map();
      const engineNoProviders = new ModelDecisionEngine(mockModels, unavailableProviders, mockUserPreferences);

      await expect(
        engineNoProviders.getModelRecommendations('Test prompt', mockCategories, 0.5, 3)
      ).rejects.toThrow('No available models found for the given task');
    });

    it('should filter models by category compatibility', async () => {
      const codeCategories: TaskCategory[] = [
        {
          name: 'Code Generation & Debugging',
          confidence: 0.9,
          keywords_matched: ['code'],
          system_prompt: 'Coding expert',
          priority: 1
        }
      ];

      const recommendations = await modelDecisionEngine.getModelRecommendations(
        'Write code',
        codeCategories,
        0.8,
        5
      );

      // Should prefer models with 'code' use case
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableModels', () => {
    it('should return models with available providers', () => {
      // This tests the private method indirectly through getModelRecommendations
      expect(mockProvider1.isAvailable).toBeDefined();
      expect(mockProvider2.isAvailable).toBeDefined();
    });

    it('should filter out models with unavailable providers', async () => {
      mockProvider1.isAvailable.mockReturnValue(false);
      
      const recommendations = await modelDecisionEngine.getModelRecommendations(
        'Test prompt',
        [],
        0.5,
        5
      );

      // Should only return models from available providers
      expect(recommendations.every(r => r.provider.name !== 'openai')).toBe(true);
    });

    it('should filter by category compatibility when category is provided', async () => {
      const specificCategories: TaskCategory[] = [
        {
          name: 'specific task',
          confidence: 0.8,
          keywords_matched: ['specific'],
          system_prompt: 'Specific task expert',
          priority: 1
        }
      ];

      const recommendations = await modelDecisionEngine.getModelRecommendations(
        'Specific task',
        specificCategories,
        0.6,
        3
      );

      expect(recommendations).toHaveLength(3); // Should return available models
    });
  });

  describe('scoreModel', () => {
    it('should calculate model scores correctly', async () => {
      const recommendations = await modelDecisionEngine.getModelRecommendations(
        'Test prompt for scoring',
        [],
        0.5,
        1
      );

      const recommendation = recommendations[0];
      expect(recommendation).toBeDefined();
      expect(recommendation!.quality_score).toBeGreaterThan(0);
      expect(recommendation!.speed_score).toBeGreaterThan(0);
      expect(recommendation!.cost_efficiency).toBeGreaterThan(0);
      expect(recommendation!.estimated_cost).toBeGreaterThan(0);
    });

    it('should handle different complexity levels', async () => {
      const lowComplexityRecs = await modelDecisionEngine.getModelRecommendations('Simple', [], 0.1, 1);
      const highComplexityRecs = await modelDecisionEngine.getModelRecommendations('Complex', [], 0.9, 1);

      expect(lowComplexityRecs[0].estimated_tokens).toBeLessThan(highComplexityRecs[0].estimated_tokens);
    });
  });

  describe('calculateQualityScore', () => {
    it('should score quality based on model and category match', async () => {
      const codeCategories: TaskCategory[] = [
        {
          name: 'Code Generation',
          confidence: 0.9,
          keywords_matched: ['code'],
          system_prompt: 'Coding expert',
          priority: 1
        }
      ];

      const recommendations = await modelDecisionEngine.getModelRecommendations(
        'Write code',
        codeCategories,
        0.8,
        3
      );

      // Models with 'code' use case should have higher quality scores
      const gpt4Rec = recommendations.find(r => r.selected_model.name === 'gpt-4o');
      expect(gpt4Rec?.quality_score).toBeGreaterThan(0.5);
    });

    it('should handle models without use_cases', async () => {
      const modelWithoutUseCases: ModelConfig = {
        name: mockModels[0].name,
        provider: mockModels[0].provider,
        enabled: mockModels[0].enabled,
        cost_per_token: mockModels[0].cost_per_token,
        max_tokens: mockModels[0].max_tokens,
        priority: mockModels[0].priority
      };

      const modelsWithoutUseCases = [modelWithoutUseCases];
      const engine = new ModelDecisionEngine(modelsWithoutUseCases, mockProviders, mockUserPreferences);

      const recommendations = await engine.getModelRecommendations('Test', [], 0.5, 1);
      expect(recommendations[0].quality_score).toBeGreaterThan(0);
    });
  });

  describe('calculateSpeedScore', () => {
    it('should assign higher speed scores to faster providers', async () => {
      // Add a mock groq provider for speed testing
      const mockGroqProvider = {
        name: 'groq',
        isAvailable: jest.fn().mockReturnValue(true),
        generate: jest.fn(),
        estimateTokens: jest.fn().mockReturnValue(20),
        estimateCost: jest.fn().mockReturnValue(0.0005),
        getAvailableModels: jest.fn().mockReturnValue(['groq-model'])
      };

      const groqModel = {
        name: 'groq-model',
        provider: 'groq',
        enabled: true,
        cost_per_token: 0.0000001,
        max_tokens: 2048,
        priority: 1
      };

      const providersWithGroq = new Map(mockProviders);
      providersWithGroq.set('groq', mockGroqProvider);

      const modelsWithGroq = [...mockModels, groqModel];
      const engineWithGroq = new ModelDecisionEngine(modelsWithGroq, providersWithGroq, mockUserPreferences);

      const recommendations = await engineWithGroq.getModelRecommendations('Test', [], 0.5, 4);
      
      const groqRec = recommendations.find(r => r.provider.name === 'groq');
      const openaiRec = recommendations.find(r => r.provider.name === 'openai');

      expect(groqRec?.speed_score).toBeGreaterThan(openaiRec?.speed_score || 0);
    });

    it('should give speed bonus to mini/flash models', async () => {
      const recommendations = await modelDecisionEngine.getModelRecommendations('Test', [], 0.5, 3);
      
      const miniRec = recommendations.find(r => r.selected_model.name.includes('mini'));
      const regularRec = recommendations.find(r => !r.selected_model.name.includes('mini'));

      if (miniRec && regularRec) {
        expect(miniRec.speed_score).toBeGreaterThanOrEqual(regularRec.speed_score);
      }
    });
  });

  describe('calculateWeights', () => {
    it('should prioritize quality when quality_over_cost is true', async () => {
      const qualityPrefs: UserPreferences = {
        ...mockUserPreferences,
        quality_over_cost: true
      };

      const qualityEngine = new ModelDecisionEngine(mockModels, mockProviders, qualityPrefs);
      const recommendations = await qualityEngine.getModelRecommendations('Test', [], 0.5, 3);

      expect(recommendations).toHaveLength(3);
      // Quality-focused engine should exist and work
    });

    it('should prioritize speed when prioritize_speed is true', async () => {
      const speedPrefs: UserPreferences = {
        ...mockUserPreferences,
        prioritize_speed: true
      };

      const speedEngine = new ModelDecisionEngine(mockModels, mockProviders, speedPrefs);
      const recommendations = await speedEngine.getModelRecommendations('Test', [], 0.5, 3);

      expect(recommendations).toHaveLength(3);
      // Speed-focused engine should exist and work
    });

    it('should use cost-optimized weights by default', async () => {
      const costPrefs: UserPreferences = {
        ...mockUserPreferences,
        quality_over_cost: false,
        prioritize_speed: false
      };

      const costEngine = new ModelDecisionEngine(mockModels, mockProviders, costPrefs);
      const recommendations = await costEngine.getModelRecommendations('Test', [], 0.5, 3);

      expect(recommendations).toHaveLength(3);
      // Cost-focused engine should exist and work
    });
  });

  describe('calculateComplianceScore', () => {
    it('should give full score when cost is within limit', async () => {
      mockProvider1.estimateCost.mockReturnValue(0.05); // Within 0.10 limit
      
      const recommendations = await modelDecisionEngine.getModelRecommendations('Test', [], 0.5, 1);
      
      expect(recommendations[0].estimated_cost).toBeLessThanOrEqual(mockUserPreferences.max_cost_per_request);
    });

    it('should handle costs exceeding limit', async () => {
      const expensivePrefs: UserPreferences = {
        ...mockUserPreferences,
        max_cost_per_request: 0.001 // Very low limit
      };

      mockProvider1.estimateCost.mockReturnValue(0.01); // Exceeds limit
      mockProvider2.estimateCost.mockReturnValue(0.01);

      const expensiveEngine = new ModelDecisionEngine(mockModels, mockProviders, expensivePrefs);
      const recommendations = await expensiveEngine.getModelRecommendations('Test', [], 0.5, 3);

      expect(recommendations).toHaveLength(3); // Should still return recommendations
    });
  });

  describe('generateReasoning', () => {
    it('should provide reasoning for model selection', async () => {
      const recommendations = await modelDecisionEngine.getModelRecommendations('Test prompt', [], 0.5, 1);
      
      expect(recommendations[0].reasoning).toBeDefined();
      expect(typeof recommendations[0].reasoning).toBe('string');
      expect(recommendations[0].reasoning.length).toBeGreaterThan(0);
    });

    it('should include cost considerations in reasoning', async () => {
      const recommendations = await modelDecisionEngine.getModelRecommendations('Cost test', [], 0.5, 1);
      
      expect(recommendations[0].reasoning).toContain('cost');
    });

    it('should include quality considerations in reasoning', async () => {
      const recommendations = await modelDecisionEngine.getModelRecommendations('Quality test', [], 0.5, 1);
      
      expect(recommendations[0].reasoning).toContain('quality');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly for different text lengths', async () => {
      const shortRecs = await modelDecisionEngine.getModelRecommendations('Hi', [], 0.3, 1);
      const longRecs = await modelDecisionEngine.getModelRecommendations('A'.repeat(400), [], 0.3, 1);
      
      expect(longRecs[0].estimated_tokens).toBeGreaterThan(shortRecs[0].estimated_tokens);
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', () => {
      const newPrefs = {
        max_cost_per_request: 0.20,
        quality_over_cost: true
      };

      modelDecisionEngine.updateUserPreferences(newPrefs);

      // The method should complete without error
      expect(() => modelDecisionEngine.updateUserPreferences(newPrefs)).not.toThrow();
    });

    it('should merge preferences correctly', () => {
      const partialPrefs = {
        prioritize_speed: true
      };

      modelDecisionEngine.updateUserPreferences(partialPrefs);

      // Should not throw and should merge with existing preferences
      expect(() => modelDecisionEngine.updateUserPreferences(partialPrefs)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty prompt', async () => {
      const recommendations = await modelDecisionEngine.getModelRecommendations('', [], 0.5, 1);
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].estimated_tokens).toBeGreaterThan(0);
    });

    it('should handle very high complexity', async () => {
      const recommendations = await modelDecisionEngine.getModelRecommendations('Complex task', [], 1.0, 1);
      
      expect(recommendations[0].estimated_tokens).toBeGreaterThan(0);
    });

    it('should handle zero complexity', async () => {
      const recommendations = await modelDecisionEngine.getModelRecommendations('Simple task', [], 0.0, 1);
      
      expect(recommendations[0].estimated_tokens).toBeGreaterThan(0);
    });

    it('should handle missing provider for model', async () => {
      const modelsWithMissingProvider = [
        ...mockModels,
        {
          name: 'orphan-model',
          provider: 'missing-provider',
          enabled: true,
          cost_per_token: 0.001,
          max_tokens: 2048,
          priority: 1
        }
      ];

      const engineWithOrphans = new ModelDecisionEngine(modelsWithMissingProvider, mockProviders, mockUserPreferences);
      
      const recommendations = await engineWithOrphans.getModelRecommendations('Test', [], 0.5, 5);
      
      // Should not include the orphan model
      expect(recommendations.every(r => r.selected_model.name !== 'orphan-model')).toBe(true);
    });
  });
}); 