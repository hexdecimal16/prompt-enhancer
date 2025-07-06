import { ProviderInterface, TaskCategory, ModelConfig } from '../types';
import { Logger } from '../utils/logger';

export interface EnhancementOptions {
  max_iterations?: number;
  strategies?: string[];
  quality_threshold?: number;
  cost_limit?: number;
}

export interface EnhancementResult {
  original_prompt: string;
  enhanced_prompt: string;
  categories: TaskCategory[];
  model_used: string;
  provider_used: string;
  iterations_performed: number;
  total_cost: number;
  applied_strategies: string[];
  quality_score: number;
  processing_time: number;
}

export class PromptEnhancer {
  private provider: ProviderInterface;
  private model: ModelConfig;
  private logger: Logger;

  constructor(provider: ProviderInterface, model: ModelConfig) {
    this.provider = provider;
    this.model = model;
    this.logger = new Logger('PromptEnhancer');
  }

  public async enhancePrompt(
    originalPrompt: string,
    categories: TaskCategory[],
    options: EnhancementOptions = {}
  ): Promise<EnhancementResult> {
    const startTime = Date.now();
    const maxIterations = options.max_iterations || 2;
    const strategies = options.strategies || ['clarity', 'specificity', 'context_enrichment'];
    const qualityThreshold = options.quality_threshold || 0.8;
    const costLimit = options.cost_limit || 0.01;

    let currentPrompt = originalPrompt;
    let totalCost = 0;
    let iterations = 0;
    let qualityScore = 0;
    const appliedStrategies: string[] = [];

    const topCategory = categories[0];
    if (!topCategory) {
      return this.createEnhancementResult(originalPrompt, originalPrompt, [], '', '', 0, 0, [], 0, Date.now() - startTime);
    }

    if (strategies.length === 0) {
      return this.createEnhancementResult(originalPrompt, originalPrompt, categories, '', '', 0, 0, [], 0, Date.now() - startTime);
    }

    for (const strategy of strategies) {
      if (iterations >= maxIterations) break;

      const estimatedCost = this.estimateTokenCost(currentPrompt);
      if (totalCost + estimatedCost > costLimit) {
        this.logger.warn('Enhancement stopped: cost limit would be exceeded', {
          currentCost: totalCost,
          estimatedCost,
          costLimit
        });
        break;
      }

      try {
        const enhancementPrompt = this.createEnhancementPrompt(currentPrompt, strategy, topCategory);
        
        this.logger.debug('Enhancement request', {
          strategy,
          iteration: iterations + 1,
          estimatedCost
        });

        const response = await this.provider.generate(enhancementPrompt, {
          model: this.model.name,
          max_tokens: 500,
          temperature: 0.3
        });

        this.logger.debug('Enhancement response received', {
          strategy,
          responseLength: response.content.length,
          cost: response.cost || 0
        });

        const enhancedPrompt = this.extractEnhancedPrompt(response.content);
        const cost = response.cost || estimatedCost;
        totalCost += cost;

        if (totalCost > costLimit) {
          this.logger.warn('Cost limit exceeded, stopping enhancement', {
            totalCost,
            costLimit,
            strategy
          });
          break;
        }

        const improvementScore = this.calculateImprovementScore(currentPrompt, enhancedPrompt);

        qualityScore = 0.5;

        if (improvementScore > 0.1) {
          currentPrompt = enhancedPrompt;
          appliedStrategies.push(strategy);
          iterations++;

          this.logger.info('Enhancement applied', {
            strategy,
            iteration: iterations,
            improvementScore: improvementScore.toFixed(3),
            cost: cost.toFixed(6),
            totalCost: totalCost.toFixed(6)
          });
        } else {
          this.logger.debug('Enhancement rejected: insufficient improvement', {
            strategy,
            improvementScore: improvementScore.toFixed(3)
          });
        }

        if (qualityScore >= qualityThreshold) {
          this.logger.info('Quality threshold reached, stopping enhancement', {
            qualityScore: qualityScore.toFixed(3),
            threshold: qualityThreshold
          });
          break;
        }

      } catch (error) {
        this.logger.error('Enhancement strategy failed', {
          strategy,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        continue;
      }
    }

    const processingTime = Math.max(1, Date.now() - startTime);

    return this.createEnhancementResult(
      originalPrompt,
      currentPrompt,
      categories,
      this.model.name,
      this.provider.name,
      iterations,
      totalCost,
      appliedStrategies,
      qualityScore,
      processingTime
    );
  }

  private createEnhancementPrompt(prompt: string, strategy: string, category: TaskCategory): string {
    const strategyInstructions = {
      clarity: 'Make the prompt clearer and more specific. Remove ambiguity and add precise requirements.',
      specificity: 'Add specific details, constraints, and expected output format. Include relevant context.',
      context_enrichment: 'Enhance with domain-specific context, examples, and best practices for better results.',
      structure: 'Improve the structure and organization of the prompt for better comprehension.',
      completeness: 'Ensure all necessary information is included and nothing important is missing.'
    };

    const instruction = strategyInstructions[strategy as keyof typeof strategyInstructions] || 
                      'Improve the prompt for better clarity and effectiveness.';

    return `You are an expert prompt engineer. Your task is to enhance the following prompt using the "${strategy}" strategy for a ${category.name} task.

Original prompt: "${prompt}"

Enhancement strategy: ${instruction}

System context: ${category.system_prompt}

Return ONLY the enhanced prompt without any explanations, prefixes, or additional text. The enhanced prompt should be clear, actionable, and optimized for the specified task category.`;
  }

  private extractEnhancedPrompt(response: string): string {
    let cleaned = response.trim();

    cleaned = cleaned.replace(/^(enhanced prompt:?\s*|improved prompt:?\s*|here's the enhanced prompt:?\s*)/i, '');

    const lines = cleaned.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      let result = lines.join(' ').trim();
      
      if (result.startsWith('"') && result.endsWith('"')) {
        result = result.slice(1, -1);
      }
      
      return result;
    }

    return cleaned;
  }

  private calculateImprovementScore(original: string, enhanced: string): number {
    if (enhanced.length <= original.length * 0.9) return 0;
    
    const lengthImprovement = Math.min(0.3, (enhanced.length - original.length) / original.length);
    const structureImprovement = enhanced.includes('Requirements:') || enhanced.includes('Context:') ? 0.2 : 0;
    const specificityImprovement = (enhanced.match(/\b(specific|exactly|must|should|will)\b/gi) || []).length > 
                                   (original.match(/\b(specific|exactly|must|should|will)\b/gi) || []).length ? 0.1 : 0;
    
    return lengthImprovement + structureImprovement + specificityImprovement;
  }

  private createEnhancementResult(
    originalPrompt: string,
    enhancedPrompt: string,
    categories: TaskCategory[],
    modelUsed: string,
    providerUsed: string,
    iterations: number,
    totalCost: number,
    appliedStrategies: string[],
    qualityScore: number,
    processingTime: number
  ): EnhancementResult {
    if (!enhancedPrompt || enhancedPrompt.trim() === '') {
      return {
        original_prompt: originalPrompt,
        enhanced_prompt: originalPrompt,
        categories,
        model_used: modelUsed,
        provider_used: providerUsed,
        iterations_performed: iterations,
        total_cost: totalCost,
        applied_strategies: appliedStrategies,
        quality_score: qualityScore,
        processing_time: processingTime
      };
    }

    return {
      original_prompt: originalPrompt,
      enhanced_prompt: enhancedPrompt,
      categories,
      model_used: modelUsed,
      provider_used: providerUsed,
      iterations_performed: iterations,
      total_cost: totalCost,
      applied_strategies: appliedStrategies,
      quality_score: qualityScore,
      processing_time: processingTime
    };
  }

  private estimateTokenCost(prompt: string): number {
    const estimatedTokens = this.estimateTokens(prompt);
    return estimatedTokens * (this.model.cost_per_token || 0.000001);
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }
} 