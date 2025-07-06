import { ProviderInterface, LLMResponse, GenerationOptions, ModelConfig } from '../types';
import { Logger } from '../utils/logger';

export abstract class BaseProvider implements ProviderInterface {
  protected logger: Logger;
  protected apiKey: string;
  protected baseUrl?: string;
  protected models: ModelConfig[];

  constructor(name: string, apiKey: string, models: ModelConfig[], baseUrl?: string) {
    this.logger = new Logger(`${name}Provider`);
    this.apiKey = apiKey;
    this.models = models;
    if (baseUrl) {
      this.baseUrl = baseUrl;
    }
  }

  abstract get name(): string;
  abstract generate(prompt: string, options: GenerationOptions): Promise<LLMResponse>;
  abstract estimateTokens(text: string): number;

  public isAvailable(): boolean {
    return !!this.apiKey && this.models.length > 0;
  }

  public getAvailableModels(): string[] {
    return this.models.filter(m => m.enabled).map(m => m.name);
  }

  public estimateCost(inputTokens: number, outputTokens: number, modelName?: string): number {
    const model = modelName 
      ? this.models.find(m => m.name === modelName)
      : this.models[0];
    
    if (!model) {
      this.logger.warn('No model found for cost estimation', { modelName, availableModels: this.getAvailableModels() });
      return 0;
    }

    // Simplified cost calculation - real implementations should have separate input/output rates
    return (inputTokens + outputTokens) * model.cost_per_token;
  }

  protected getModelConfig(modelName: string): ModelConfig | undefined {
    return this.models.find(m => m.name === modelName && m.enabled);
  }

  protected logUsage(response: LLMResponse): void {
    this.logger.info('LLM API call completed', {
      model: response.model,
      provider: response.provider,
      tokens_used: response.tokens_used,
      cost: response.cost,
      processing_time: response.processing_time,
      cached: response.cached
    });
  }

  protected handleError(error: any, context: string): never {
    this.logger.error(`Provider error in ${context}`, { error: error as Error });
    throw new Error(`${this.name} provider error: ${error.message || error}`);
  }
}

export class TokenEstimator {
  /**
   * Simple token estimation based on character count
   * Real implementations should use provider-specific tokenizers
   */
  public static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    const charCount = text.length;
    const tokenCount = Math.ceil(charCount / 4);
    return Math.max(1, tokenCount);
  }

  /**
   * Estimate tokens for different content types
   */
  public static estimateTokensByType(text: string, contentType: 'code' | 'prose' | 'structured'): number {
    const baseTokens = this.estimateTokens(text);
    
    switch (contentType) {
      case 'code':
        // Code typically has more tokens per character due to syntax
        return Math.ceil(baseTokens * 1.3);
      case 'structured':
        // Structured data (JSON, XML) has more efficient tokenization
        return Math.ceil(baseTokens * 0.8);
      case 'prose':
      default:
        return baseTokens;
    }
  }
}

export interface ProviderFactory {
  createProvider(name: string, config: any): ProviderInterface | null;
}

export class ProviderRegistry {
  private static providers: Map<string, ProviderFactory> = new Map();

  public static register(name: string, factory: ProviderFactory): void {
    this.providers.set(name, factory);
  }

  public static create(name: string, config: any): ProviderInterface | null {
    const factory = this.providers.get(name);
    return factory ? factory.createProvider(name, config) : null;
  }

  public static getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
