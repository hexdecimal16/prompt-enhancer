import { GoogleProvider } from '../../src/providers/google-provider';
import { ModelConfig, GenerationOptions } from '../../src/types';

// Mock Google AI SDK
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
      countTokens: jest.fn()
    })
  }))
}));

// Mock Logger
jest.mock('../../src/utils/logger');

describe('GoogleProvider', () => {
  let googleProvider: GoogleProvider;
  let mockModels: ModelConfig[];
  let mockClient: any;

  beforeEach(() => {
    mockModels = [
      {
        name: 'gemini-1.5-flash',
        provider: 'google',
        enabled: true,
        cost_per_token: 0.000001,
        max_tokens: 8192,
        priority: 1
      },
      {
        name: 'gemini-1.5-pro',
        provider: 'google',
        enabled: true,
        cost_per_token: 0.000002,
        max_tokens: 8192,
        priority: 2
      }
    ];

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    mockClient = {
      getGenerativeModel: jest.fn(),
      countTokens: jest.fn()
    };
    GoogleGenerativeAI.mockReturnValue(mockClient);

    googleProvider = new GoogleProvider('test-api-key', mockModels);
  });

  describe('constructor', () => {
    it('should initialize with API key and models', () => {
      expect(googleProvider).toBeInstanceOf(GoogleProvider);
      expect(googleProvider.name).toBe('Google');
      expect(googleProvider.isAvailable()).toBe(true);
    });

    it('should initialize without base URL', () => {
      const provider = new GoogleProvider('test-key', mockModels);
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe('generate', () => {
    let mockModel: any;

    beforeEach(() => {
      mockModel = {
        generateContent: jest.fn(),
        countTokens: jest.fn().mockResolvedValue({ totalTokens: 25 })
      };
      mockClient.getGenerativeModel.mockReturnValue(mockModel);
    });

    it('should generate content successfully', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Generated response text'),
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 15,
            totalTokenCount: 25
          }
        }
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      const options: GenerationOptions = {
        model: 'gemini-1.5-flash',
        max_tokens: 100,
        temperature: 0.7
      };

      const result = await googleProvider.generate('Test prompt', options);

      expect(result.content).toBe('Generated response text');
      expect(result.model).toBe('gemini-1.5-flash');
      expect(result.provider).toBe('Google');
      expect(result.tokens_used.input).toBe(10);
      expect(result.tokens_used.output).toBe(15);
      expect(result.tokens_used.total).toBe(25);
      expect(result.cost).toBeGreaterThan(0);
      expect(result.processing_time).toBeGreaterThanOrEqual(0); 
    });

    it('should use default model when none specified', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Response'),
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 10,
            totalTokenCount: 15
          }
        }
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await googleProvider.generate('Test prompt', {});

      expect(result.model).toBe('gemini-1.5-flash'); // First model in array
    });

    it('should handle missing usage metadata', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Response without metadata')
        }
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await googleProvider.generate('Test prompt', {});

      expect(result.tokens_used.input).toBe(3); 
      expect(result.tokens_used.output).toBe(7); 
      expect(result.tokens_used.total).toBe(10);
    });

    it('should handle API errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));

      await expect(
        googleProvider.generate('Test prompt', {})
      ).rejects.toThrow('Google provider error: API Error');
    });

    it('should handle generation config correctly', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Configured response'),
          usageMetadata: {
            promptTokenCount: 8,
            candidatesTokenCount: 12,
            totalTokenCount: 20
          }
        }
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      const options: GenerationOptions = {
        model: 'gemini-1.5-pro',
        max_tokens: 200,
        temperature: 0.3,
        top_p: 0.9
      };

      await googleProvider.generate('Test with config', options);

      expect(mockClient.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-1.5-pro',
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.3,
          topP: 0.9
        }
      });
    });

    it('should throw error for unknown model', async () => {
      const options: GenerationOptions = {
        model: 'unknown-model'
      };

      await expect(
        googleProvider.generate('Test prompt', options)
      ).rejects.toThrow('Google provider error: Model unknown-model not found or not enabled');
    });

    it('should handle empty response text', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue(''),
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 0,
            totalTokenCount: 5
          }
        }
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await googleProvider.generate('Test prompt', {});

      expect(result.content).toBe('');
      expect(result.tokens_used.output).toBe(0); 
    });

    it('should handle response without text method', async () => {
      const mockResponse = {
        response: {
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 10,
            totalTokenCount: 15
          }
        }
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(
        googleProvider.generate('Test prompt', {})
      ).rejects.toThrow();
    });
  });

  describe('healthCheck', () => {
    let mockModel: any;

    beforeEach(() => {
      mockModel = {
        generateContent: jest.fn()
      };
      mockClient.getGenerativeModel.mockReturnValue(mockModel);
    });

    it('should return true for successful health check', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Health check response')
        }
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      const isHealthy = await googleProvider.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false when no models available', async () => {
      const providerNoModels = new GoogleProvider('test-key', []);
      
      const isHealthy = await providerNoModels.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false on API error', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Health check failed'));

      const isHealthy = await googleProvider.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false on empty response', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('')
        }
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      const isHealthy = await googleProvider.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should use first available model for health check', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('OK')
        }
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      await googleProvider.healthCheck();

      expect(mockClient.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-1.5-flash',
        generationConfig: {
          maxOutputTokens: 10
        }
      });
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for given text', () => {
      const text = 'Hello world, this is a test message';
      const tokens = googleProvider.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('should handle empty text', () => {
      const tokens = googleProvider.estimateTokens('');
      expect(tokens).toBe(1); // Minimum 1 token
    });

    it('should handle very long text', () => {
      const longText = 'A'.repeat(10000);
      const tokens = googleProvider.estimateTokens(longText);

      expect(tokens).toBeGreaterThan(1000);
    });

    it('should handle unicode characters', () => {
      const unicodeText = '🚀 Hello 世界 🌍';
      const tokens = googleProvider.estimateTokens(unicodeText);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle null API key', () => {
      const provider = new GoogleProvider('', mockModels);
      expect(provider.isAvailable()).toBe(false);
    });

    it('should handle undefined models', () => {
      const provider = new GoogleProvider('test-key', []);
      expect(provider.getAvailableModels()).toEqual([]);
      expect(provider.isAvailable()).toBe(false);
    });

    it('should handle very long prompts', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Long prompt response'),
          usageMetadata: {
            promptTokenCount: 1000,
            candidatesTokenCount: 100,
            totalTokenCount: 1100
          }
        }
      };
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue(mockResponse),
        countTokens: jest.fn().mockResolvedValue({ totalTokens: 1000 })
      };
      mockClient.getGenerativeModel.mockReturnValue(mockModel);

      const longPrompt = 'A'.repeat(10000);
      const result = await googleProvider.generate(longPrompt, {});

      expect(result.content).toBe('Long prompt response');
      expect(result.tokens_used.input).toBe(1000); // From usage metadata 
    });

    it('should handle generation config with all options', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Full config response'),
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30
          }
        }
      };
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue(mockResponse),
        countTokens: jest.fn().mockResolvedValue({ totalTokens: 10 })
      };
      mockClient.getGenerativeModel.mockReturnValue(mockModel);

      const fullOptions: GenerationOptions = {
        model: 'gemini-1.5-pro',
        max_tokens: 500,
        temperature: 0.8,
        top_p: 0.95,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
        stop: ['END', 'STOP']
      };

      await googleProvider.generate('Full config test', fullOptions);

      expect(mockClient.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-1.5-pro',
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.8,
          topP: 0.95,
          stopSequences: ['END', 'STOP']
        }
      });
    });

    it('should handle countTokens error gracefully', async () => {
      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Token count error response'),
          usageMetadata: {
            promptTokenCount: 15,
            candidatesTokenCount: 25,
            totalTokenCount: 40
          }
        }
      };
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue(mockResponse),
        countTokens: jest.fn().mockRejectedValue(new Error('Token count failed'))
      };
      mockClient.getGenerativeModel.mockReturnValue(mockModel);

      const result = await googleProvider.generate('Token count test', {});

      expect(result.content).toBe('Token count error response');
      expect(result.tokens_used.input).toBe(15); 
    });
  });
}); 