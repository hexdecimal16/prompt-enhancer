import { CategoryConfig, TaskCategory, AnalysisResult, ModelConfig, ProviderInterface } from '../types';
import { Logger } from '../utils/logger';
import { TagLLMCategorizer, TagMap } from './tag-llm-categorizer';

export class TaskCategorizer {
  private logger: Logger;
  private categories: Record<string, CategoryConfig>;
  private tagger?: TagLLMCategorizer;

  constructor(
    categories: Record<string, CategoryConfig>,
    taggerConfig?: { provider: ProviderInterface; model: ModelConfig; tagMap: TagMap }
  ) {
    this.logger = new Logger('TaskCategorizer');
    this.categories = categories;

    if (taggerConfig) {
      this.tagger = new TagLLMCategorizer(taggerConfig.provider, taggerConfig.model, taggerConfig.tagMap);
    }
  }

  public async categorizeTask(prompt: string): Promise<TaskCategory[]> {
    if (!this.tagger) {
      this.logger.warn('TaskCategorizer is not configured with a tagger. Returning empty category list.');
      return [];
    }
    
    try {
      const tagCats = await this.tagger.categorize(prompt, this.categories);
      return tagCats;
    } catch (err) {
      this.logger.error('Tag-based categorization failed', { err });
      return []; // Return empty on error
    }
  }

  public async analyzeComplexity(prompt: string): Promise<AnalysisResult> {
    const categories = await this.categorizeTask(prompt);
    
    // Calculate complexity score based on various factors
    const promptLength = prompt.length;
    const wordCount = prompt.split(/\s+/).length;
    const hasCodeBlocks = /```[\s\S]*?```/.test(prompt);
    const hasMultipleQuestions = (prompt.match(/\?/g) || []).length > 1;
    const hasSpecialChars = /[{}()[\]<>|&^%$#@!~`]/.test(prompt);

    let complexityScore = 0;
    
    // Length-based complexity (adjusted thresholds)
    if (promptLength > 800) complexityScore += 0.35;
    else if (promptLength > 400) complexityScore += 0.25;
    else if (promptLength > 150) complexityScore += 0.15;
    
    // Word count complexity
    if (wordCount > 200) complexityScore += 0.2;
    else if (wordCount > 100) complexityScore += 0.1;
    
    // Content complexity
    if (hasCodeBlocks) complexityScore += 0.25;
    if (hasMultipleQuestions) complexityScore += 0.2;
    if (hasSpecialChars) complexityScore += 0.15;
    
    // Category-based complexity
    if (categories.length > 2) complexityScore += 0.2;
    
    complexityScore = Math.min(complexityScore, 1.0);

    // Recommend model based on complexity and categories
    const recommendedModel = this.recommendModel(complexityScore, categories);
    
    // Estimate cost based on complexity
    const estimatedCost = this.estimateCost(promptLength, complexityScore);

    return {
      categories,
      complexity_score: complexityScore,
      recommended_model: recommendedModel,
      estimated_cost: estimatedCost,
      confidence: categories[0]?.confidence || 0
    };
  }

  private recommendModel(complexity: number, categories: TaskCategory[]): ModelConfig {
    // This is a simplified recommendation logic. 
    // A more advanced version would use the ModelDecisionEngine.
    const topCategory = categories[0];

    if (complexity > 0.6 || topCategory?.name.includes('Code')) {
      return { name: 'gpt-4o', provider: 'openai', cost_per_token: 0.000005, max_tokens: 4096, priority: 1, enabled: true };
    }
    
    if (complexity >= 0.25) {
      return { name: 'claude-3.5-sonnet', provider: 'anthropic', cost_per_token: 0.000003, max_tokens: 4096, priority: 2, enabled: true };
    }

    return { name: 'gpt-4o-mini', provider: 'openai', cost_per_token: 0.00000015, max_tokens: 4096, priority: 3, enabled: true };
  }

  private estimateCost(promptLength: number, complexity: number): number {
    const baseTokenCost = 0.000001; // A generic base cost per token
    const complexityMultiplier = 1 + (complexity * 2); // Higher complexity = higher estimated output tokens
    const estimatedTokens = Math.max(1, promptLength / 4); // Minimum 1 token, rough estimate otherwise
    return estimatedTokens * baseTokenCost * complexityMultiplier;
  }
} 