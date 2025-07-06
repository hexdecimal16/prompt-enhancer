import { BaseProvider, TokenEstimator } from './base-provider';
import { LLMResponse, GenerationOptions, ModelConfig } from '../types';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GoogleProvider extends BaseProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string, models: ModelConfig[], baseUrl?: string) {
    super('Google', apiKey, models, baseUrl);
    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  get name(): string {
    return 'Google';
  }

  public async generate(prompt: string, options: GenerationOptions = {}): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const modelName = options.model || this.models[0]?.name;
      if (!modelName) {
        throw new Error('No model specified and no default model available.');
      }
      const modelConfig = this.getModelConfig(modelName);
      if (!modelConfig) {
        throw new Error(`Model ${options.model} not found or not enabled`);
      }

      const model = this.client.getGenerativeModel({
        model: modelConfig.name,
        generationConfig: {
          temperature: options.temperature || 0.7,
          topP: options.top_p || 0.9,
          maxOutputTokens: options.max_tokens || modelConfig.max_tokens || 1000,
          ...(options.stop && { stopSequences: options.stop })
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      // Use usage metadata if available, otherwise estimate
      let inputTokens, outputTokens, totalTokens;
      if (response.usageMetadata) {
        inputTokens = response.usageMetadata.promptTokenCount !== undefined 
          ? response.usageMetadata.promptTokenCount 
          : this.estimateTokens(prompt);
        outputTokens = response.usageMetadata.candidatesTokenCount !== undefined
          ? response.usageMetadata.candidatesTokenCount
          : this.estimateTokens(content);
        totalTokens = response.usageMetadata.totalTokenCount !== undefined
          ? response.usageMetadata.totalTokenCount
          : (inputTokens + outputTokens);
      } else {
        inputTokens = this.estimateTokens(prompt);
        outputTokens = this.estimateTokens(content);
        totalTokens = inputTokens + outputTokens;
      }

      const llmResponse: LLMResponse = {
        content,
        tokens_used: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        },
        cost: this.estimateCost(inputTokens, outputTokens, modelConfig.name),
        model: modelConfig.name,
        provider: this.name,
        processing_time: Date.now() - startTime,
        cached: false
      };

      this.logUsage(llmResponse);
      return llmResponse;

    } catch (error) {
      this.handleError(error, 'generate');
    }
  }

  public override estimateTokens(text: string): number {
    return TokenEstimator.estimateTokens(text);
  }

  public override estimateCost(inputTokens: number, outputTokens: number, modelName?: string): number {
    const model = modelName 
      ? this.models.find(m => m.name === modelName)
      : this.models[0];
    
    if (!model) {
      this.logger.warn('No model found for cost estimation', { modelName, availableModels: this.getAvailableModels() });
      return 0;
    }

    // Google pricing is typically similar for input/output tokens
    return (inputTokens + outputTokens) * model.cost_per_token;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const firstModel = this.models[0];
      if (!firstModel) {
        return false;
      }
      
      const model = this.client.getGenerativeModel({
        model: firstModel.name,
        generationConfig: {
          maxOutputTokens: 10
        }
      });
      
      const result = await model.generateContent('Test');
      const response = await result.response;
      return response.text().length > 0;
    } catch (error) {
      this.logger.error('Health check failed', { error: error as Error });
      return false;
    }
  }
} 