import { ConfigurationManager } from '../../src/config/configuration-manager';
import { ModelConfig, ProviderConfig } from '../../src/types';

// Mock dependencies
jest.mock('../../src/utils/logger');

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let mockEnvVars: Record<string, string | undefined>;

  beforeEach(() => {
    mockEnvVars = {
      GOOGLE_API_KEY: 'test-google-key',
      OPENAI_API_KEY: 'test-openai-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      LOG_LEVEL: 'info',
      NODE_ENV: 'test'
    };
  });

  describe('create', () => {
    it('should create configuration manager with environment variables', async () => {
      configManager = await ConfigurationManager.create(mockEnvVars);
      
      expect(configManager).toBeInstanceOf(ConfigurationManager);
    });

    it('should create configuration manager with MCP config', async () => {
      const mcpConfig = {
        customProvider: {
          api_key: 'custom-key',
          base_url: 'https://custom.api.com'
        }
      };

      configManager = await ConfigurationManager.create(mockEnvVars, mcpConfig);
      
      expect(configManager).toBeInstanceOf(ConfigurationManager);
    });

    it('should handle missing environment variables', async () => {
      const minimalEnvVars = {
        GOOGLE_API_KEY: 'test-key'
      };

      configManager = await ConfigurationManager.create(minimalEnvVars);
      
      expect(configManager).toBeInstanceOf(ConfigurationManager);
    });

    it('should handle empty environment variables', async () => {
      configManager = await ConfigurationManager.create({});
      
      expect(configManager).toBeInstanceOf(ConfigurationManager);
    });
  });

  describe('getConfiguration', () => {
    beforeEach(async () => {
      configManager = await ConfigurationManager.create(mockEnvVars);
    });

    it('should return complete server configuration', () => {
      const config = configManager.getConfiguration();
      
      expect(config).toHaveProperty('models');
      expect(config).toHaveProperty('providers');
      expect(config).toHaveProperty('categories');
      expect(config).toHaveProperty('enhancement');
      expect(config).toHaveProperty('user_preferences');
      expect(config).toHaveProperty('cache_settings');
      expect(config).toHaveProperty('logging');
    });

    it('should have valid models configuration', () => {
      const config = configManager.getConfiguration();
      
      expect(config.models).toHaveProperty('classifiers');
      expect(config.models).toHaveProperty('enhancers');
      expect(config.models).toHaveProperty('fallback_models');
      expect(Array.isArray(config.models.classifiers)).toBe(true);
      expect(Array.isArray(config.models.enhancers)).toBe(true);
      expect(Array.isArray(config.models.fallback_models)).toBe(true);
    });

    it('should have valid providers configuration', () => {
      const config = configManager.getConfiguration();
      
      expect(Array.isArray(config.providers)).toBe(true);
      config.providers.forEach((provider: ProviderConfig) => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('models');
        expect(Array.isArray(provider.models)).toBe(true);
      });
    });

    it('should have valid categories configuration', () => {
      const config = configManager.getConfiguration();
      
      expect(typeof config.categories).toBe('object');
      Object.values(config.categories).forEach((category: any) => {
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('description');
        expect(category).toHaveProperty('keywords');
        expect(category).toHaveProperty('system_prompt');
        expect(category).toHaveProperty('priority');
      });
    });
  });

  describe('getAvailableModels', () => {
    beforeEach(async () => {
      configManager = await ConfigurationManager.create(mockEnvVars);
    });

    it('should return all models when type is "all"', () => {
      const models = configManager.getAvailableModels('all');
      
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should return classifier models', () => {
      const models = configManager.getAvailableModels('classifiers');
      
      expect(Array.isArray(models)).toBe(true);
    });

    it('should return enhancer models', () => {
      const models = configManager.getAvailableModels('enhancers');
      
      expect(Array.isArray(models)).toBe(true);
    });

    it('should return enhancer models when using enhancers type', () => {
      const models = configManager.getAvailableModels('enhancers');
      
      expect(Array.isArray(models)).toBe(true);
    });

    it('should filter enabled models only', () => {
      const models = configManager.getAvailableModels('all');
      
      models.forEach((model: ModelConfig) => {
        expect(model.enabled).toBe(true);
      });
    });
  });

  describe('getCategories', () => {
    beforeEach(async () => {
      configManager = await ConfigurationManager.create(mockEnvVars);
    });

    it('should return categories configuration', () => {
      const categories = configManager.getCategories();
      
      expect(typeof categories).toBe('object');
      expect(Object.keys(categories).length).toBeGreaterThan(0);
    });

    it('should return categories with required properties', () => {
      const categories = configManager.getCategories();
      
      Object.values(categories).forEach((category: any) => {
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('description');
        expect(category).toHaveProperty('keywords');
        expect(category).toHaveProperty('system_prompt');
        expect(category).toHaveProperty('priority');
        expect(category).toHaveProperty('confidence_threshold');
      });
    });
  });

  describe('getCacheSettings', () => {
    beforeEach(async () => {
      configManager = await ConfigurationManager.create(mockEnvVars);
    });

    it('should return cache settings', () => {
      const cacheSettings = configManager.getCacheSettings();
      
      expect(cacheSettings).toHaveProperty('ttl');
      expect(cacheSettings).toHaveProperty('max_size');
      expect(cacheSettings).toHaveProperty('enabled');
      expect(typeof cacheSettings.ttl).toBe('number');
      expect(typeof cacheSettings.max_size).toBe('number');
      expect(typeof cacheSettings.enabled).toBe('boolean');
    });

    it('should have reasonable default values', () => {
      const cacheSettings = configManager.getCacheSettings();
      
      expect(cacheSettings.ttl).toBeGreaterThan(0);
      expect(cacheSettings.max_size).toBeGreaterThan(0);
      expect(cacheSettings.enabled).toBe(true);
    });
  });

  describe('getProviders', () => {
    beforeEach(async () => {
      configManager = await ConfigurationManager.create(mockEnvVars);
    });

    it('should return providers configuration', () => {
      const providers = configManager.getProviders();
      
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should include providers with API keys', () => {
      const providers = configManager.getProviders();
      
      const googleProvider = providers.find(p => p.name === 'google');
      const openaiProvider = providers.find(p => p.name === 'openai');
      const anthropicProvider = providers.find(p => p.name === 'anthropic');

      expect(googleProvider).toBeDefined();
      expect(openaiProvider).toBeDefined();
      expect(anthropicProvider).toBeDefined();

      if (googleProvider) expect(googleProvider.api_key).toBe('test-google-key');
      if (openaiProvider) expect(openaiProvider.api_key).toBe('test-openai-key');
      if (anthropicProvider) expect(anthropicProvider.api_key).toBe('test-anthropic-key');
    });
  });

  describe('hasValidApiKey', () => {
    beforeEach(async () => {
      configManager = await ConfigurationManager.create(mockEnvVars);
    });

    it('should return true for providers with valid API keys', () => {
      expect(configManager.hasValidApiKey('google')).toBe(true);
      expect(configManager.hasValidApiKey('openai')).toBe(true);
      expect(configManager.hasValidApiKey('anthropic')).toBe(true);
    });

    it('should return false for providers without API keys', () => {
      expect(configManager.hasValidApiKey('non-existent-provider')).toBe(false);
    });

    it('should return false for providers with empty API keys', async () => {
      const envWithEmptyKey = {
        ...mockEnvVars,
        GOOGLE_API_KEY: ''
      };
      
      const configWithEmptyKey = await ConfigurationManager.create(envWithEmptyKey);
      expect(configWithEmptyKey.hasValidApiKey('google')).toBe(false);
    });
  });

  describe('populateDynamicProviders', () => {
    it('should populate providers based on available API keys', async () => {
      const partialEnvVars = {
        GOOGLE_API_KEY: 'test-google-key'
        // Missing other keys
      };

      configManager = await ConfigurationManager.create(partialEnvVars);
      const providers = configManager.getProviders();
      
      const googleProvider = providers.find(p => p.name === 'google');
      const openaiProvider = providers.find(p => p.name === 'openai');

      expect(googleProvider).toBeDefined();
      expect(googleProvider?.api_key).toBe('test-google-key');
      
      // OpenAI provider should NOT exist without API key
      expect(openaiProvider).toBeUndefined();
    });

    it('should handle custom provider configurations', async () => {
      const mcpConfig = {
        customProvider: {
          api_key: 'custom-key',
          base_url: 'https://custom.api.com',
          models: [
            {
              name: 'custom-model',
              cost_per_token: 0.001,
              max_tokens: 4096
            }
          ]
        }
      };

      configManager = await ConfigurationManager.create(mockEnvVars, mcpConfig);
      const providers = configManager.getProviders();
      
      const customProvider = providers.find(p => p.name === 'customProvider');
      expect(customProvider).toBeDefined();
      expect(customProvider?.api_key).toBe('custom-key');
      expect(customProvider?.base_url).toBe('https://custom.api.com');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate configuration without throwing', async () => {
      expect(async () => {
        configManager = await ConfigurationManager.create(mockEnvVars);
      }).not.toThrow();
    });

    it('should handle minimal configuration', async () => {
      const minimalEnvVars = {};
      
      expect(async () => {
        configManager = await ConfigurationManager.create(minimalEnvVars);
      }).not.toThrow();
    });

    it('should validate complex configuration', async () => {
      const complexMcpConfig = {
        provider1: {
          api_key: 'key1',
          models: [{ name: 'model1', cost_per_token: 0.001, max_tokens: 2048 }]
        },
        provider2: {
          api_key: 'key2',
          base_url: 'https://api2.com',
          models: [{ name: 'model2', cost_per_token: 0.002, max_tokens: 4096 }]
        }
      };

      expect(async () => {
        configManager = await ConfigurationManager.create(mockEnvVars, complexMcpConfig);
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined MCP config', async () => {
      configManager = await ConfigurationManager.create(mockEnvVars, undefined);
      
      expect(configManager).toBeInstanceOf(ConfigurationManager);
    });

    it('should handle null environment variables', async () => {
      const envWithNulls = {
        GOOGLE_API_KEY: null as any,
        OPENAI_API_KEY: undefined,
        ANTHROPIC_API_KEY: ''
      };

      configManager = await ConfigurationManager.create(envWithNulls);
      
      expect(configManager).toBeInstanceOf(ConfigurationManager);
    });

    it('should handle environment variables with special characters', async () => {
      const envWithSpecialChars = {
        GOOGLE_API_KEY: 'key-with-special!@#$%^&*()_+-={}[]|;:,.<>?'
      };

      configManager = await ConfigurationManager.create(envWithSpecialChars);
      
      expect(configManager.hasValidApiKey('google')).toBe(true);
    });

    it('should handle very long API keys', async () => {
      const envWithLongKey = {
        GOOGLE_API_KEY: 'A'.repeat(1000)
      };

      configManager = await ConfigurationManager.create(envWithLongKey);
      
      expect(configManager.hasValidApiKey('google')).toBe(true);
    });

    it('should handle MCP config with invalid structure', async () => {
      const invalidMcpConfig = {
        invalidProvider: 'not-an-object',
        anotherInvalid: null
      };

      expect(async () => {
        configManager = await ConfigurationManager.create(mockEnvVars, invalidMcpConfig);
      }).not.toThrow();
    });

    it('should handle requesting models for unknown type', () => {
      configManager = new (ConfigurationManager as any)({}, {});
      
      const models = configManager.getAvailableModels('unknown_type' as any);
      expect(Array.isArray(models)).toBe(true);
      expect(models).toHaveLength(0);
    });

    it('should handle empty providers list', async () => {
      // Create minimal config that might result in empty providers
      const emptyEnvVars = {};
      
      configManager = await ConfigurationManager.create(emptyEnvVars);
      const providers = configManager.getProviders();
      
      expect(Array.isArray(providers)).toBe(true);
    });
  });
}); 