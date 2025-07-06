import { ModelConfig, UserPreferences, TaskCategory, ProviderInterface } from '../types';
import { Logger } from '../utils/logger';

export interface ModelDecision {
  selected_model: ModelConfig;
  provider: ProviderInterface;
  reasoning: string;
  estimated_cost: number;
  estimated_tokens: number;
  quality_score: number;
  speed_score: number;
  cost_efficiency: number;
}

export class ModelDecisionEngine {
  private logger: Logger;
  private models: ModelConfig[];
  private providers: Map<string, ProviderInterface>;
  private userPreferences: UserPreferences;

  constructor(models: ModelConfig[], providers: Map<string, ProviderInterface>, userPreferences: UserPreferences) {
    this.logger = new Logger('ModelDecisionEngine');
    this.models = models.filter(m => m.enabled);
    this.providers = providers;
    this.userPreferences = userPreferences;
  }

  public async selectOptimalModel(
    prompt: string,
    categories: TaskCategory[],
    complexity: number
  ): Promise<ModelDecision> {
    const promptTokens = this.estimateTokens(prompt);
    const topCategory = categories[0];
    
    // Filter models based on availability and compatibility
    const availableModels = this.getAvailableModels(topCategory);
    
    if (availableModels.length === 0) {
      throw new Error('No available models found for the given task');
    }

    // Score each model based on multiple criteria
    const modelScores = await Promise.all(
      availableModels.map(model => this.scoreModel(model, prompt, categories, complexity, promptTokens))
    );

    // Sort by weighted score
    modelScores.sort((a, b) => b.weightedScore - a.weightedScore);
    
    const bestModel = modelScores[0];

    if (!bestModel) {
      throw new Error('Could not determine a best model.');
    }

    const provider = this.providers.get(bestModel.model.provider);
    
    if (!provider) {
      throw new Error(`Provider ${bestModel.model.provider} not available`);
    }

    const decision: ModelDecision = {
      selected_model: bestModel.model,
      provider,
      reasoning: bestModel.reasoning,
      estimated_cost: bestModel.estimatedCost,
      estimated_tokens: bestModel.estimatedTokens,
      quality_score: bestModel.qualityScore,
      speed_score: bestModel.speedScore,
      cost_efficiency: bestModel.costEfficiency
    };

    this.logger.info('Model selected', {
      model: bestModel.model.name,
      provider: bestModel.model.provider,
      estimated_cost: bestModel.estimatedCost,
      quality_score: bestModel.qualityScore,
      reasoning: bestModel.reasoning.substring(0, 100) + '...'
    });

    return decision;
  }

  private getAvailableModels(topCategory?: TaskCategory): ModelConfig[] {
    const enabledModels = this.models.filter(model => {
      // Check if provider is available
      const provider = this.providers.get(model.provider);
      return provider && provider.isAvailable();
    });

    // If no category provided, return all enabled models
    if (!topCategory) {
      return enabledModels;
    }

    // Try to filter by category compatibility, but be more lenient
    const categoryFilteredModels = enabledModels.filter(model => {
      if (!model.use_cases || model.use_cases.length === 0) {
        return true; // Include models without use cases
      }

      const categoryName = topCategory.name.toLowerCase();
      const hasMatch = model.use_cases.some(useCase => {
        const lowerUseCase = useCase.toLowerCase();
        const lowerCategoryName = categoryName.toLowerCase();
        
        // More flexible matching - check for partial matches
        return lowerCategoryName.includes(lowerUseCase) || 
               lowerUseCase.includes(lowerCategoryName) ||
               // Also check individual words
               categoryName.split(' ').some(word => 
                 word.toLowerCase().includes(lowerUseCase) || 
                 lowerUseCase.includes(word.toLowerCase())
               );
      });
      
      return hasMatch;
    });

    // Always return all enabled models if filtering results in less than 2 models
    // This ensures we have multiple options for recommendation comparisons
    return categoryFilteredModels.length >= 2 ? categoryFilteredModels : enabledModels;
  }

  private async scoreModel(
    model: ModelConfig,
    _prompt: string,
    categories: TaskCategory[],
    complexity: number,
    promptTokens: number
  ): Promise<{
    model: ModelConfig;
    weightedScore: number;
    qualityScore: number;
    speedScore: number;
    costEfficiency: number;
    estimatedCost: number;
    estimatedTokens: number;
    reasoning: string;
  }> {
    const provider = this.providers.get(model.provider);
    if (!provider) {
      throw new Error(`Provider ${model.provider} not available`);
    }

    // Estimate output tokens based on complexity and prompt length
    const outputTokens = Math.ceil(promptTokens * (0.5 + complexity * 1.5));
    const totalTokens = promptTokens + outputTokens;
    
    // Calculate estimated cost
    const estimatedCost = provider.estimateCost(promptTokens, outputTokens);
    
    // Quality score based on model quality and category match
    const qualityScore = this.calculateQualityScore(model, categories, complexity);
    
    // Speed score based on provider and model characteristics
    const speedScore = this.calculateSpeedScore(model, provider);
    
    // Cost efficiency (quality per dollar)
    const costEfficiency = estimatedCost > 0 ? qualityScore / estimatedCost : qualityScore;
    
    // Apply user preferences to weighting
    const weights = this.calculateWeights();
    
    const weightedScore = 
      (qualityScore * weights.quality) +
      (speedScore * weights.speed) +
      (costEfficiency * weights.cost) +
      (this.calculateComplianceScore(estimatedCost) * weights.compliance);

    const reasoning = this.generateReasoning(model, qualityScore, speedScore, costEfficiency, estimatedCost, categories);

    return {
      model,
      weightedScore,
      qualityScore,
      speedScore,
      costEfficiency,
      estimatedCost,
      estimatedTokens: totalTokens,
      reasoning
    };
  }

  private calculateQualityScore(model: ModelConfig, categories: TaskCategory[], complexity: number): number {
    let score = model.quality_score || 0.5;
    
    // Boost score based on category compatibility
    const topCategory = categories[0];
    if (topCategory && model.use_cases) {
      const categoryName = topCategory.name.toLowerCase();
      const hasCompatibleUseCase = model.use_cases.some(useCase => 
        categoryName.includes(useCase.toLowerCase()) || 
        useCase.toLowerCase().includes(categoryName)
      );
      if (hasCompatibleUseCase) {
        score += 0.2;
      }
    }

    // Adjust for complexity
    if (complexity > 0.7 && model.name.includes('o1')) {
      score += 0.3; // o1 models are better for complex reasoning
    } else if (complexity > 0.5 && model.name.includes('claude-3.5-sonnet')) {
      score += 0.2; // Claude 3.5 Sonnet is good for complex tasks
    } else if (complexity < 0.3 && model.name.includes('mini')) {
      score += 0.1; // Mini models are fine for simple tasks
    }

    return Math.min(score, 1.0);
  }

  private calculateSpeedScore(model: ModelConfig, provider: ProviderInterface): number {
    let score = 0.5; // Base speed score

    // Provider-based speed scoring
    switch (provider.name.toLowerCase()) {
      case 'groq':
        score += 0.4; // Groq is very fast
        break;
      case 'openai':
        score += 0.2; // OpenAI is moderately fast
        break;
      case 'anthropic':
        score += 0.1; // Anthropic is slower but quality
        break;
      case 'google':
        score += 0.3; // Google is fast
        break;
    }

    // Model-based speed scoring
    if (model.name.includes('mini') || model.name.includes('flash')) {
      score += 0.2; // Smaller models are faster
    } else if (model.name.includes('o1') || model.name.includes('opus')) {
      score -= 0.1; // Larger models are slower
    }

    return Math.min(score, 1.0);
  }

  private calculateWeights(): { quality: number; speed: number; cost: number; compliance: number } {
    const prefs = this.userPreferences;
    
    if (prefs.quality_over_cost) {
      return { quality: 0.5, speed: 0.2, cost: 0.2, compliance: 0.1 };
    } else if (prefs.prioritize_speed) {
      return { quality: 0.3, speed: 0.4, cost: 0.2, compliance: 0.1 };
    } else {
      // Cost-optimized
      return { quality: 0.3, speed: 0.2, cost: 0.4, compliance: 0.1 };
    }
  }

  private calculateComplianceScore(estimatedCost: number): number {
    const maxCost = this.userPreferences.max_cost_per_request;
    
    if (estimatedCost <= maxCost) {
      return 1.0;
    } else if (estimatedCost <= maxCost * 1.5) {
      return 0.5;
    } else {
      return 0.0;
    }
  }

  private generateReasoning(
    model: ModelConfig,
    qualityScore: number,
    speedScore: number,
    costEfficiency: number,
    estimatedCost: number,
    categories: TaskCategory[]
  ): string {
    const reasons: string[] = [];
    
    reasons.push(`Selected ${model.name} from ${model.provider}`);
    
    if (qualityScore > 0.8) {
      reasons.push('high quality score for this task type');
    } else if (qualityScore > 0.6) {
      reasons.push('good quality score');
    } else {
      reasons.push('acceptable quality score');
    }

    if (speedScore > 0.7) {
      reasons.push('fast response time');
    } else if (speedScore > 0.5) {
      reasons.push('moderate response time');
    }

    if (costEfficiency > 0.8) {
      reasons.push('excellent cost efficiency');
    } else if (costEfficiency > 0.5) {
      reasons.push('good cost efficiency');
    }

    if (estimatedCost < this.userPreferences.max_cost_per_request * 0.5) {
      reasons.push('low cost');
    } else if (estimatedCost <= this.userPreferences.max_cost_per_request) {
      reasons.push('within budget');
    }

    const topCategory = categories[0];
    if (topCategory && model.use_cases) {
      const categoryName = topCategory.name.toLowerCase();
      const hasCompatibleUseCase = model.use_cases.some(useCase => 
        categoryName.includes(useCase.toLowerCase()) || 
        useCase.toLowerCase().includes(categoryName)
      );
      if (hasCompatibleUseCase) {
        reasons.push(`optimized for ${topCategory.name}`);
      }
    }

    return reasons.join(', ');
  }

  private estimateTokens(text: string): number {
    // Simple token estimation - should be replaced with actual tokenizer
    // Ensure minimum of 1 token even for empty strings
    return Math.max(1, Math.ceil(text.length / 4));
  }

  public async getModelRecommendations(
    prompt: string,
    categories: TaskCategory[],
    complexity: number,
    limit: number = 3
  ): Promise<ModelDecision[]> {
    const promptTokens = this.estimateTokens(prompt);
    const topCategory = categories[0];
    
    const availableModels = this.getAvailableModels(topCategory);
    
    if (availableModels.length === 0) {
      throw new Error('No available models found for the given task');
    }

    const modelScores = await Promise.all(
      availableModels.map(model => this.scoreModel(model, prompt, categories, complexity, promptTokens))
    );

    // Sort by weighted score and take top N
    modelScores.sort((a, b) => b.weightedScore - a.weightedScore);
    
    const recommendations: ModelDecision[] = [];
    
    for (let i = 0; i < Math.min(limit, modelScores.length); i++) {
      const modelScore = modelScores[i];
      if (!modelScore) {
        continue;
      }
      const provider = this.providers.get(modelScore.model.provider);
      
      if (provider) {
        recommendations.push({
          selected_model: modelScore.model,
          provider,
          reasoning: modelScore.reasoning,
          estimated_cost: modelScore.estimatedCost,
          estimated_tokens: modelScore.estimatedTokens,
          quality_score: modelScore.qualityScore,
          speed_score: modelScore.speedScore,
          cost_efficiency: modelScore.costEfficiency
        });
      }
    }

    return recommendations;
  }

  public updateUserPreferences(preferences: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences };
    this.logger.info('User preferences updated', { preferences });
  }
} 