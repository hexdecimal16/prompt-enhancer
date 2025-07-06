import { ServerConfig, ModelConfig, ProviderConfig, CategoryConfig, ValidationResult } from '../types';
import { Logger } from '../utils/logger';
import { fetchGoogleModels } from '../utils/google-models';

export class ConfigurationManager {
  private config: ServerConfig;
  private logger: Logger;
  private mcpConfig?: any;

  private constructor(envVars: Record<string, string | undefined>, mcpConfig?: any) {
    this.logger = new Logger('ConfigurationManager');
    this.mcpConfig = mcpConfig;
    this.config = this.loadConfiguration(envVars, mcpConfig);
    // validate later after dynamic providers inserted
  }

  // Factory: builds instance and performs async provider discovery
  public static async create(envVars: Record<string, string | undefined>, mcpConfig?: any): Promise<ConfigurationManager> {
    const manager = new ConfigurationManager(envVars, mcpConfig);
    await manager.populateDynamicProviders(envVars);
    manager.validateConfiguration();
    return manager;
  }

  private async populateDynamicProviders(envVars: Record<string, string | undefined>): Promise<void> {
    const providers: ProviderConfig[] = [];
    let allModels: ModelConfig[] = [];

    // Try dynamic Google model fetch
    if (envVars['GOOGLE_API_KEY']) {
      try {
        const googleModels = await fetchGoogleModels(envVars['GOOGLE_API_KEY']);
        if (googleModels.length) {
          this.logger.info('Fetched Google model catalogue', { count: googleModels.length });
          providers.push({
            name: 'google',
            api_key: envVars['GOOGLE_API_KEY'],
            models: googleModels
          });
          allModels = [...allModels, ...googleModels];
        } else {
          // Fallback to static Google models
          this.addStaticGoogleProvider(providers, allModels, envVars['GOOGLE_API_KEY']);
        }
      } catch (err) {
        this.logger.warn('Dynamic Google model fetch failed, falling back to static list', { err });
        // Fallback to static Google models
        this.addStaticGoogleProvider(providers, allModels, envVars['GOOGLE_API_KEY']);
      }
    }

    // Add other static providers
    this.addStaticProviders(providers, allModels, envVars);
    
    // Add custom providers from MCP config (passed through constructor)
    this.addMcpProviders(providers, allModels);

    // Update configuration
    this.config.providers = providers;
    if (allModels.length > 0) {
      this.config.models.classifiers = allModels.slice().sort((a,b)=> a.priority-b.priority);
      this.config.models.enhancers = allModels.slice().sort((a,b)=> a.priority-b.priority);
      this.config.models.fallback_models = allModels.slice(0,1);
    }
  }

  private loadConfiguration(envVars: Record<string, string | undefined>, mcpConfig?: any): ServerConfig {
    const defaultConfig: ServerConfig = {
      models: {
        classifiers: [],
        enhancers: [],
        fallback_models: []
      },
      providers: [],
      categories: this.getDefaultCategories(),
      enhancement: {
        max_iterations: 2,
        quality_threshold: 0.8,
        cost_limit_per_enhancement: 0.01,
        enhancement_strategies: ['clarity', 'specificity', 'context_enrichment']
      },
      user_preferences: {
        max_cost_per_request: 0.05,
        prioritize_speed: true,
        enable_caching: true,
        quality_over_cost: false
      },
      cache_settings: {
        ttl: 3600,
        max_size: 1000,
        enabled: true
      },
      logging: {
        level: 'info'
      }
    };

    // Load from MCP config if provided
    if (mcpConfig?.config) {
      this.mergeConfig(defaultConfig, mcpConfig.config);
    }

    // Load from environment variables
    this.loadFromEnvironment(defaultConfig, envVars);

    // Initialize providers based on available API keys
    this.initializeProviders(defaultConfig, envVars);

    return defaultConfig;
  }

  private getDefaultCategories(): Record<string, CategoryConfig> {
    return {
      'code_generation': {
        name: 'Code Generation & Debugging',
        description: 'Programming, debugging, and code-related tasks',
        keywords: ['code', 'write', 'app'],
        system_prompt: `You are an expert software engineer with deep knowledge of multiple programming languages and best practices. 
        Your task is to help with code generation, debugging, and optimization. 
        Always provide clean, efficient, and well-documented code.
        When debugging, explain the issue clearly and provide the corrected code.
        Consider security, performance, and maintainability in your solutions.`,
        priority: 1,
        token_cost: 200,
        compatibility: ['gpt-4o-mini', 'claude-3-haiku', 'claude-3.5-sonnet', 'deepseek-coder'],
        confidence_threshold: 0.1
      },
      'creative_writing': {
        name: 'Creative Writing & Content Creation',
        description: 'Creative writing, storytelling, and content generation',
        keywords: ['story', 'creative', 'plot'],
        system_prompt: `You are a skilled creative writer and content creator with expertise in various writing styles and formats.
        Your task is to help create engaging, original, and well-structured content.
        Focus on creativity, narrative flow, and audience engagement.
        Adapt your writing style to match the requested tone and purpose.
        Provide vivid descriptions and compelling storytelling when appropriate.`,
        priority: 2,
        token_cost: 150,
        compatibility: ['gpt-4o', 'claude-3.5-sonnet', 'claude-3-opus'],
        confidence_threshold: 0.6
      },
      'data_analysis': {
        name: 'Data Analysis & Visualization',
        description: 'Data processing, analysis, and visualization tasks',
        keywords: ['data', 'analysis', 'chart'],
        system_prompt: `You are a data analyst and statistician expert in data processing, analysis, and visualization.
        Your task is to help analyze data, identify patterns, and create meaningful insights.
        Provide clear explanations of analytical methods and statistical concepts.
        Suggest appropriate visualization techniques and tools.
        Always validate data quality and highlight potential limitations or biases.`,
        priority: 3,
        token_cost: 180,
        compatibility: ['gpt-4o', 'claude-3.5-sonnet', 'gemini-pro'],
        confidence_threshold: 0.75
      },
      'technical_documentation': {
        name: 'Technical Documentation',
        description: 'API documentation, technical specifications, and guides',
        keywords: ['documentation', 'API', 'guide'],
        system_prompt: `You are a technical writer specializing in creating clear, comprehensive documentation.
        Your task is to help create well-structured technical documentation that is easy to understand and follow.
        Use clear language, logical organization, and appropriate formatting.
        Include examples, code snippets, and practical use cases when relevant.
        Ensure documentation is accessible to the target audience's technical level.`,
        priority: 4,
        token_cost: 120,
        compatibility: ['gpt-4o-mini', 'claude-3-haiku', 'claude-3.5-sonnet'],
        confidence_threshold: 0.7
      },
      'problem_solving': {
        name: 'Problem Solving & Mathematics',
        description: 'Mathematical problems, logical reasoning, and complex problem solving',
        keywords: ['math', 'problem', 'solve'],
        system_prompt: `You are a mathematician and problem-solving expert with strong analytical and reasoning skills.
        Your task is to help solve complex problems using logical thinking and mathematical principles.
        Break down problems into manageable steps and explain your reasoning clearly.
        Show all work and verify solutions when possible.
        Consider multiple approaches and explain the most efficient solution methods.`,
        priority: 5,
        token_cost: 160,
        compatibility: ['gpt-4o', 'claude-3.5-sonnet', 'o1-mini'],
        confidence_threshold: 0.8
      },
      'research_synthesis': {
        name: 'Research & Information Synthesis',
        description: 'Research tasks, information gathering, and synthesis',
        keywords: ['research', 'information', 'synthesis'],
        system_prompt: `You are a research analyst skilled in gathering, evaluating, and synthesizing information from multiple sources.
        Your task is to help conduct thorough research and provide comprehensive, well-sourced information.
        Evaluate source credibility and present balanced perspectives.
        Synthesize information from multiple viewpoints and highlight key insights.
        Organize findings in a clear, logical structure with proper citations when applicable.`,
        priority: 6,
        token_cost: 140,
        compatibility: ['gpt-4o', 'claude-3.5-sonnet', 'gemini-pro'],
        confidence_threshold: 0.65
      },
      'conversational': {
        name: 'Conversational & General Q&A',
        description: 'General conversation, Q&A, and casual interactions',
        keywords: ['chat', 'question', 'answer'],
        system_prompt: `You are a knowledgeable and friendly conversational assistant.
        Your task is to engage in natural, helpful conversations and answer questions across a wide range of topics.
        Be personable, clear, and informative in your responses.
        Adapt your communication style to match the user's tone and level of formality.
        Ask clarifying questions when needed to provide the most helpful responses.`,
        priority: 7,
        token_cost: 100,
        compatibility: ['gpt-4o-mini', 'claude-3-haiku', 'gemini-flash'],
        confidence_threshold: 0.5
      },
      'educational': {
        name: 'Educational & Tutoring',
        description: 'Teaching, tutoring, and educational content',
        keywords: ['teach', 'learn', 'lesson'],
        system_prompt: `You are an experienced educator and tutor skilled in teaching complex concepts in an accessible way.
        Your task is to help learners understand topics through clear explanations and examples.
        Adapt your teaching style to different learning levels and preferences.
        Use analogies, examples, and step-by-step breakdowns to make concepts clear.
        Encourage questions and provide constructive feedback to support learning.`,
        priority: 8,
        token_cost: 130,
        compatibility: ['gpt-4o', 'claude-3.5-sonnet', 'claude-3-haiku'],
        confidence_threshold: 0.6
      },
      'business_writing': {
        name: 'Business & Professional Writing',
        description: 'Business communication, reports, and professional content',
        keywords: ['business', 'report', 'email'],
        system_prompt: `You are a business communication expert skilled in professional writing and strategic thinking.
        Your task is to help create clear, professional business communications and documents.
        Use appropriate business language and formatting conventions.
        Focus on clarity, conciseness, and actionable insights.
        Consider the business context and audience when crafting messages.`,
        priority: 9,
        token_cost: 110,
        compatibility: ['gpt-4o', 'claude-3.5-sonnet', 'claude-3-haiku'],
        confidence_threshold: 0.7
      },
      'linux_terminal': {
        name: 'Linux Terminal Simulation',
        description: 'Simulate a Linux terminal and execute commands',
        keywords: ['linux', 'terminal'],
        system_prompt: `You are a Linux terminal. Execute the user\'s shell commands and respond with only the command output. Do not provide explanations unless explicitly asked. Maintain the exact formatting of typical command-line output.`,
        priority: 10,
        token_cost: 90,
        compatibility: ['gpt-4o-mini', 'claude-3-haiku'],
        confidence_threshold: 0.5
      },
      'translator': {
        name: 'Translation & Localization',
        description: 'Translate text and improve grammar/style',
        keywords: ['translate', 'language'],
        system_prompt: `You are a professional translator and localization expert. Translate the given text accurately while preserving tone and style. When asked for improvements, refine grammar, clarity, and fluency without altering meaning.`,
        priority: 11,
        token_cost: 110,
        compatibility: ['gpt-4o-mini', 'claude-3.5-sonnet'],
        confidence_threshold: 0.6
      },
      'travel_guide': {
        name: 'Travel Guide',
        description: 'Provide travel advice and itineraries',
        keywords: ['travel', 'guide'],
        system_prompt: `You are a seasoned travel guide with deep knowledge of global destinations. Offer personalized itineraries, local tips, and cultural insights. Always consider safety, budget, and traveler preferences.`,
        priority: 12,
        token_cost: 100,
        compatibility: ['gpt-4o', 'claude-3.5-sonnet'],
        confidence_threshold: 0.55
      },
      'excel_sheet': {
        name: 'Excel Sheet Simulation',
        description: 'Respond like a text-based Excel spreadsheet',
        keywords: ['excel', 'sheet'],
        system_prompt: `You are a text-based Excel sheet. Reply only with the spreadsheet output (rows and columns) inside a single code block. Execute formulas when provided. Do not add explanations unless requested. Keep formatting consistent with typical CSV-like tables.`,
        priority: 13,
        token_cost: 80,
        compatibility: ['gpt-4o-mini', 'claude-3-haiku'],
        confidence_threshold: 0.5
      },
      'javascript_console': {
        name: 'JavaScript Console Simulation',
        description: 'Simulate a JS console and execute code',
        keywords: ['javascript', 'console'],
        system_prompt: `You are a JavaScript console. Respond with the exact output of executed commands wrapped in one code block. Do not provide explanations or run commands unless instructed.`,
        priority: 14,
        token_cost: 90,
        compatibility: ['gpt-4o-mini', 'claude-3-haiku'],
        confidence_threshold: 0.5
      },
      'storyteller': {
        name: 'Storytelling',
        description: 'Craft engaging and imaginative stories',
        keywords: ['story', 'tale'],
        system_prompt: `You are a master storyteller. Create captivating narratives with a clear arc, vivid descriptions, and emotional resonance. Tailor tone and complexity to the audience and purpose.`,
        priority: 15,
        token_cost: 120,
        compatibility: ['gpt-4o', 'claude-3.5-sonnet'],
        confidence_threshold: 0.55
      },
      'role_play': {
        name: 'Role Simulation & Persona Emulation',
        description: 'Requests that ask the assistant to act as a specific persona, profession, or simulator (e.g., "act as a Linux terminal", "pretend to be a psychologist").',
        keywords: ['act as', 'pretend to', 'act like', 'simulate', 'roleplay', 'I want you to act', 'You are about to immerse'],
        system_prompt: `You are a highly adaptable AI capable of adopting any requested persona or simulation. Carefully follow the user\'s instructions to embody the specified role, maintaining the requested tone, knowledge, and response constraints. Never break character unless explicitly asked. Always prioritize the authenticity and internal consistency of the chosen persona while still adhering to safety policies.`,
        priority: 16,
        token_cost: 110,
        compatibility: ['gpt-4o', 'claude-3.5-sonnet', 'claude-3-haiku'],
        confidence_threshold: 0.4
      }
    };
  }

  private mergeConfig(target: ServerConfig, source: any): void {
    if (source.models) {
      if (source.models.classifiers) {
        target.models.classifiers = source.models.classifiers.filter((m: ModelConfig) => m.enabled);
      }
      if (source.models.enhancers) {
        target.models.enhancers = source.models.enhancers.filter((m: ModelConfig) => m.enabled);
      }
      if (source.models.fallback_models) {
        target.models.fallback_models = source.models.fallback_models;
      }
    }

    if (source.enhancement) {
      Object.assign(target.enhancement, source.enhancement);
    }

    if (source.user_preferences) {
      Object.assign(target.user_preferences, source.user_preferences);
    }

    if (source.cache_settings) {
      Object.assign(target.cache_settings, source.cache_settings);
    }

    if (source.logging) {
      Object.assign(target.logging, source.logging);
    }
  }

  private loadFromEnvironment(config: ServerConfig, envVars: Record<string, string | undefined>): void {
    if (envVars['LOG_LEVEL']) {
      config.logging.level = envVars['LOG_LEVEL'];
    }

    if (envVars['CACHE_TTL']) {
      config.cache_settings.ttl = parseInt(envVars['CACHE_TTL']);
    }

    if (envVars['MAX_COST_PER_REQUEST']) {
      config.user_preferences.max_cost_per_request = parseFloat(envVars['MAX_COST_PER_REQUEST']);
    }

    if (envVars['PRIORITIZE_SPEED']) {
      config.user_preferences.prioritize_speed = envVars['PRIORITIZE_SPEED'] === 'true';
    }

    if (envVars['ENABLE_CACHING']) {
      config.cache_settings.enabled = envVars['ENABLE_CACHING'] === 'true';
    }
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private initializeProviders(_config: ServerConfig, _envVars: Record<string, string | undefined>): void {
    // legacy no-op; dynamic provider population happens in populateDynamicProviders
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  private validateConfiguration(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if at least one provider is configured
    if (this.config.providers.length === 0) {
      errors.push('No LLM providers configured. Please set at least one API key.');
    }

    // Check if at least one model is available
    if (this.config.models.classifiers.length === 0) {
      errors.push('No classifier models available. Please configure at least one model.');
    }

    if (this.config.models.enhancers.length === 0) {
      errors.push('No enhancer models available. Please configure at least one model.');
    }

    // Validate cost limits
    if (this.config.user_preferences.max_cost_per_request <= 0) {
      warnings.push('Max cost per request should be positive.');
    }

    if (this.config.enhancement && this.config.enhancement.cost_limit_per_enhancement && this.config.enhancement.cost_limit_per_enhancement <= 0) {
      warnings.push('Cost limit per enhancement should be positive.');
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, 100 - (errors.length * 25) - (warnings.length * 5))
    };

    if (!result.valid) {
      this.logger.error('Configuration validation failed', { errors, warnings });
    } else if (warnings.length > 0) {
      this.logger.warn('Configuration validation warnings', { warnings });
    }

    return result;
  }

  public getConfiguration(): ServerConfig {
    return { ...this.config };
  }

  public getProviders(): ProviderConfig[] {
    return this.config.providers;
  }

  public getAvailableModels(type: 'classifiers' | 'enhancers' | 'all' = 'all'): ModelConfig[] {
    switch (type) {
      case 'classifiers':
        return this.config.models.classifiers.filter(m => this.hasValidApiKey(m.provider));
      case 'enhancers':
        return this.config.models.enhancers.filter(m => this.hasValidApiKey(m.provider));
      case 'all':
        return [...this.config.models.classifiers, ...this.config.models.enhancers]
          .filter(m => this.hasValidApiKey(m.provider));
      default:
        return [];
    }
  }

  public getCategories(): Record<string, CategoryConfig> {
    return this.config.categories;
  }

  public updateModelConfig(modelName: string, updates: Partial<ModelConfig>): boolean {
    try {
      const allModels = [...this.config.models.classifiers, ...this.config.models.enhancers];
      const model = allModels.find(m => m.name === modelName);
      
      if (!model) {
        this.logger.warn(`Model ${modelName} not found for update`);
        return false;
      }

      Object.assign(model, updates);
      this.logger.info(`Model ${modelName} configuration updated`, { updates });
      return true;
    } catch (error) {
      this.logger.error('Error updating model configuration', { error, modelName, updates });
      return false;
    }
  }

  public hasValidApiKey(provider: string): boolean {
    const providerConfig = this.config.providers.find(p => p.name === provider);
    return !!providerConfig?.api_key;
  }

  public getModelConfig(modelName: string): ModelConfig | undefined {
    const allModels = [...this.config.models.classifiers, ...this.config.models.enhancers];
    return allModels.find(m => m.name === modelName);
  }

  public getCostLimit(): number {
    return this.config.user_preferences.max_cost_per_request;
  }

  public shouldPrioritizeSpeed(): boolean {
    return this.config.user_preferences.prioritize_speed;
  }

  public isCachingEnabled(): boolean {
    return this.config.cache_settings.enabled;
  }

  public getCacheSettings() {
    return this.config.cache_settings;
  }

  public getLogLevel(): string {
    return this.config.logging.level;
  }

  public getBraveApiKey(): string | undefined {
    // Check environment variable first
    const envKey = process.env['BRAVE_API_KEY'];
    if (envKey) {
      return envKey;
    }

    // Check MCP config
    return this.mcpConfig?.brave_api_key;
  }

  private addStaticGoogleProvider(providers: ProviderConfig[], allModels: ModelConfig[], apiKey: string): void {
    const googleModels: ModelConfig[] = [
      {
        name: 'gemini-1.5-flash',
        provider: 'google',
        enabled: true,
        cost_per_token: 0.000001,
        max_tokens: 1048576,
        priority: 1,
        quality_score: 0.85,
        use_cases: ['general', 'code', 'writing']
      },
      {
        name: 'gemini-1.5-pro',
        provider: 'google',
        enabled: true,
        cost_per_token: 0.000005,
        max_tokens: 2097152,
        priority: 2,
        quality_score: 0.95,
        use_cases: ['reasoning', 'analysis', 'code']
      }
    ];

    providers.push({
      name: 'google',
      api_key: apiKey,
      models: googleModels
    });
    allModels.push(...googleModels);
  }

  private addStaticProviders(providers: ProviderConfig[], allModels: ModelConfig[], envVars: Record<string, string | undefined>): void {
    // OpenAI Provider
    if (envVars['OPENAI_API_KEY']) {
      const openaiModels: ModelConfig[] = [
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
          name: 'gpt-4o-mini',
          provider: 'openai',
          enabled: true,
          cost_per_token: 0.000001,
          max_tokens: 4096,
          priority: 2,
          quality_score: 0.8,
          use_cases: ['general', 'quick']
        }
      ];

      providers.push({
        name: 'openai',
        api_key: envVars['OPENAI_API_KEY'],
        models: openaiModels
      });
      allModels.push(...openaiModels);
    }

    // Anthropic Provider
    if (envVars['ANTHROPIC_API_KEY']) {
      const anthropicModels: ModelConfig[] = [
        {
          name: 'claude-3.5-sonnet',
          provider: 'anthropic',
          enabled: true,
          cost_per_token: 0.000003,
          max_tokens: 4096,
          priority: 1,
          quality_score: 0.9,
          use_cases: ['writing', 'analysis', 'code']
        },
        {
          name: 'claude-3-haiku',
          provider: 'anthropic',
          enabled: true,
          cost_per_token: 0.000001,
          max_tokens: 4096,
          priority: 2,
          quality_score: 0.75,
          use_cases: ['general', 'quick']
        }
      ];

      providers.push({
        name: 'anthropic',
        api_key: envVars['ANTHROPIC_API_KEY'],
        models: anthropicModels
      });
      allModels.push(...anthropicModels);
    }
  }

  private addMcpProviders(providers: ProviderConfig[], allModels: ModelConfig[]): void {
    if (!this.mcpConfig) return;

    // Look for custom provider configurations in MCP config
    Object.entries(this.mcpConfig).forEach(([providerName, providerConfig]: [string, any]) => {
      if (providerConfig && typeof providerConfig === 'object' && providerConfig.api_key) {
        const models: ModelConfig[] = [];
        
        if (providerConfig.models && Array.isArray(providerConfig.models)) {
          providerConfig.models.forEach((modelConfig: any) => {
            if (modelConfig.name) {
              models.push({
                name: modelConfig.name,
                provider: providerName,
                enabled: true,
                cost_per_token: modelConfig.cost_per_token || 0.001,
                max_tokens: modelConfig.max_tokens || 4096,
                priority: modelConfig.priority || 1,
                quality_score: modelConfig.quality_score || 0.8,
                use_cases: modelConfig.use_cases || ['general']
              });
            }
          });
        }

        const provider: ProviderConfig = {
          name: providerName,
          api_key: providerConfig.api_key,
          models
        };

        if (providerConfig.base_url) {
          (provider as any).base_url = providerConfig.base_url;
        }

        providers.push(provider);
        allModels.push(...models);
      }
    });
  }
}