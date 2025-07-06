import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequest,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { ProviderInterface } from './types';
import { ConfigurationManager } from './config/configuration-manager';
import {
  TaskCategorizer,
  ModelDecisionEngine,
  PromptEnhancer,
  CacheService,
} from './services';
import { TagMap } from './services/tag-llm-categorizer';
import { createProvider } from './providers';
import { Logger } from './utils/logger';
import { ModelConfig } from './types';

interface ProcessPromptRequest {
  prompt: string;
  options?: {
    enhancement_level?: 'basic' | 'detailed' | 'comprehensive';
    preferred_provider?: string;
    cost_limit?: number;
    target_category?: string;
  };
}

interface GetRecommendationsRequest {
  prompt: string;
  options?: {
    cost_limit?: number;
    min_quality?: number;
    limit?: number;
  };
}

interface AnalyzeComplexityRequest {
  prompt: string;
}

interface GetStatsRequest {
  detailed?: boolean;
}

export class PromptEnhancerMCPServer {
  private mcpServer: Server;
  private logger: Logger;
  private configManager: ConfigurationManager;
  private providers: Map<string, ProviderInterface> = new Map();
  private taskCategorizer: TaskCategorizer;
  private modelDecisionEngine: ModelDecisionEngine;
  private promptEnhancer: PromptEnhancer | undefined;
  private cacheService: CacheService;

  private constructor(configManager: ConfigurationManager) {
    this.logger = new Logger('PromptEnhancerServer');
    this.configManager = configManager;

    this.mcpServer = new Server(
      {
        name: 'prompt-enhancer',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.initializeProviders();
    const { enhancementProvider, enhancementModel } = this.getEnhancementProvider();

    // Determine a low-cost classifier model (first by cheapest cost_per_token)
    const classifierModels = this.configManager.getAvailableModels('classifiers');
    const sortedClassifierModels = classifierModels.sort((a, b) => a.cost_per_token - b.cost_per_token);
    const classifierModel = sortedClassifierModels[0];
    const classifierProvider = classifierModel ? this.providers.get(classifierModel.provider) : undefined;

    // Tag map definition (can be externalized)
    const tagMap: TagMap = {
      code: ['code_generation', 'technical_documentation'],
      math: ['problem_solving'],
      api: ['technical_documentation'],
      research: ['research_synthesis'],
      role: ['role_play', 'linux_terminal'],
      translate: ['translator'],
      language: ['translator'],
      terminal: ['linux_terminal'],
      linux: ['linux_terminal'],
    };

    this.taskCategorizer = new TaskCategorizer(
      this.configManager.getCategories(),
      classifierProvider && classifierModel
        ? { provider: classifierProvider, model: classifierModel, tagMap }
        : undefined,
    );
    this.modelDecisionEngine = new ModelDecisionEngine(
      this.configManager.getAvailableModels('all'),
      this.providers,
      this.configManager.getConfiguration().user_preferences,
    );
    
    // Only create PromptEnhancer if we have valid provider and model
    if (enhancementProvider && enhancementModel) {
      this.promptEnhancer = new PromptEnhancer(
        enhancementProvider,
        enhancementModel,
      );
    } else {
      this.promptEnhancer = undefined;
      this.logger.warn('PromptEnhancer not available due to missing provider or model');
    }
    
    const cacheSettings = this.configManager.getCacheSettings();
    this.cacheService = new CacheService(cacheSettings.ttl, cacheSettings.max_size);

    this.setupTools();
  }

  private initializeProviders(): void {
    for (const providerConfig of this.configManager.getConfiguration().providers) {
      try {
        const provider = createProvider(providerConfig.name, providerConfig);
        if (provider) {
          this.providers.set(providerConfig.name, provider);
          this.logger.info(`Provider initialized: ${providerConfig.name}`);
        }
      } catch (error) {
        this.logger.error(`Failed to initialize provider: ${providerConfig.name}`, { error });
      }
    }
  }

  private setupTools(): void {
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'process_prompt',
            description: 'Enhances and processes a user prompt.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
                options: { type: 'object' },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'get_recommendations',
            description: 'Gets model recommendations for a prompt.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
                options: { type: 'object' },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'analyze_complexity',
            description: 'Analyzes the complexity of a prompt.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'get_stats',
            description: 'Gets server statistics.',
            inputSchema: {
              type: 'object',
              properties: {
                detailed: { type: 'boolean' },
              },
            },
          },
          {
            name: 'clear_cache',
            description: 'Clears the server cache.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    this.mcpServer.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest) => {
        const { name: toolName, arguments: args } = request.params;

        try {
          switch (toolName) {
            case 'process_prompt':
              return await this.handleProcessPrompt(
                args as unknown as ProcessPromptRequest,
              );
            case 'get_recommendations':
              return await this.handleGetRecommendations(
                args as unknown as GetRecommendationsRequest,
              );
            case 'analyze_complexity':
              return await this.handleAnalyzeComplexity(
                args as unknown as AnalyzeComplexityRequest,
              );
            case 'get_stats':
              return await this.handleGetStats(
                args as unknown as GetStatsRequest,
              );
            case 'clear_cache':
              return await this.handleClearCache();
            default:
              throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown tool: ${toolName}`,
              );
          }
        } catch (error) {
          this.logger.error('Tool execution failed', {
            tool: toolName,
            error: error as Error,
          });
          throw new McpError(
            ErrorCode.InternalError,
            `Tool execution failed: ${error}`,
          );
        }
      },
    );
  }

  private async handleProcessPrompt(
    request: ProcessPromptRequest,
  ): Promise<any> {
    const { prompt, options = {} } = request;
    const { enhancement_level, cost_limit } = options;

    try {
      this.logger.info('Processing prompt', {
        prompt: prompt.substring(0, 50) + '...',
      });

      // --------------------------------------------------
      // 1. Try to serve from cache first
      // --------------------------------------------------
      const cachedEnhancement = this.cacheService.getCachedEnhancement(prompt);
      if (cachedEnhancement) {
        this.logger.info('Returning cached enhancement result');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, result: cachedEnhancement }),
            },
          ],
        };
      }

      // --------------------------------------------------
      // 2. Get task categories (use cache if available)
      // --------------------------------------------------
      let categories = this.cacheService.getCachedCategories(prompt);
      if (!categories) {
        categories = await this.taskCategorizer.categorizeTask(prompt);
        this.cacheService.cacheCategories(prompt, categories);
      }
      // TypeScript safeguard: ensure categories is an array
      categories = categories || [];

      // --------------------------------------------------
      // 3. Enhance the prompt
      // --------------------------------------------------
      let result;
      if (this.promptEnhancer) {
        result = await this.promptEnhancer.enhancePrompt(
          prompt,
          categories,
          {
            max_iterations:
              enhancement_level === 'comprehensive'
                ? 3
                : enhancement_level === 'detailed'
                ? 2
                : 1,
            cost_limit: cost_limit,
          },
        );
      } else {
        // Fallback when no enhancement provider is available
        this.logger.warn('Enhancement provider not available, returning original prompt');
        result = {
          original_prompt: prompt,
          enhanced_prompt: prompt,
          categories,
          model_used: '',
          provider: '',
          estimated_tokens: Math.ceil(prompt.length / 4),
          estimated_cost: 0,
          enhancement_strategies: [],
          quality_score: 0,
          processing_time: 0
        };
      }

      // Cache the enhancement result for future identical requests
      this.cacheService.cacheEnhancement(prompt, result);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, result }),
          },
        ],
      };
    } catch (error) {
      this.logger.error('Process prompt failed', { error: error as Error });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: (error as Error).message,
            }),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetRecommendations(
    request: GetRecommendationsRequest,
  ): Promise<any> {
    const { prompt, options = {} } = request;
    const { limit } = options;

    try {
      this.logger.info('Getting recommendations', {
        prompt: prompt.substring(0, 50) + '...',
      });
      const categories = await this.taskCategorizer.categorizeTask(prompt);
      const complexity = await this.taskCategorizer.analyzeComplexity(prompt);
      const recommendations =
        await this.modelDecisionEngine.getModelRecommendations(
          prompt,
          categories,
          complexity.complexity_score,
          limit,
        );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, recommendations }),
          },
        ],
      };
    } catch (error) {
      this.logger.error('Get recommendations failed', {
        error: error as Error,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: (error as Error).message,
            }),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleAnalyzeComplexity(
    request: AnalyzeComplexityRequest,
  ): Promise<any> {
    const { prompt } = request;
    try {
      this.logger.info('Analyzing complexity', {
        prompt: prompt.substring(0, 50) + '...',
      });
      const analysis = await this.taskCategorizer.analyzeComplexity(prompt);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, analysis }),
          },
        ],
      };
    } catch (error) {
      this.logger.error('Analyze complexity failed', {
        error: error as Error,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: (error as Error).message,
            }),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetStats(request: GetStatsRequest): Promise<any> {
    const { detailed = false } = request;
    try {
      this.logger.info('Getting stats', { detailed });
      const stats = this.getStats(detailed);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, stats }),
          },
        ],
      };
    } catch (error) {
      this.logger.error('Error getting stats', { error });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: (error as Error).message,
            }),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleClearCache(): Promise<any> {
    try {
      this.logger.info('Clearing cache');
      this.cacheService.clear();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Cache cleared successfully',
            }),
          },
        ],
      };
    } catch (error) {
      this.logger.error('Error clearing cache', { error });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: (error as Error).message,
            }),
          },
        ],
        isError: true,
      };
    }
  }

  private getStats(detailed: boolean = false): any {
    const stats = {
      cache: detailed ? this.cacheService.getDetailedStats() : this.cacheService.getStats(),
      providers: this.providers.size,
      models: this.configManager.getAvailableModels().length
    };
    return stats;
  }

  private getEnhancementProvider(): { enhancementProvider: ProviderInterface | undefined, enhancementModel: ModelConfig | undefined } {
    const enhancementProvider = this.providers.get('openai') || this.providers.values().next().value;
    const enhancementModel = this.configManager.getConfiguration().models.enhancers.find(m => m.name.includes('mini')) || 
                            this.configManager.getConfiguration().models.enhancers[0];
    
    if (!enhancementProvider || !enhancementModel) {
      this.logger.warn('Enhancement provider or model not found, some features will be disabled');
    }
    
    return { enhancementProvider, enhancementModel };
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    this.logger.info('MCP Server started');
  }

  public async stop(): Promise<void> {
    await this.mcpServer.close();
    this.logger.info('MCP Server stopped');
  }

  // Factory creator
  public static async create(): Promise<PromptEnhancerMCPServer> {
    const configManager = await ConfigurationManager.create(process.env);
    return new PromptEnhancerMCPServer(configManager);
  }
} 