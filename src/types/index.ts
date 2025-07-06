/**
 * Core types for the Prompt Enhancer MCP Server
 */

export interface ModelConfig {
  name: string;
  provider: string;
  enabled: boolean;
  cost_per_token: number;
  max_tokens: number;
  priority: number;
  quality_score?: number;
  context_window?: number;
  use_cases?: string[];
}

export interface ProviderConfig {
  name: string;
  api_key?: string;
  base_url?: string;
  models: ModelConfig[];
  rate_limits?: {
    rpm?: number;
    tpm?: number;
    concurrent_requests?: number;
  };
}

export interface CategoryConfig {
  name: string;
  description: string;
  keywords: string[];
  system_prompt: string;
  priority: number;
  token_cost: number;
  compatibility: string[];
  confidence_threshold: number;
}

export interface EnhancementConfig {
  max_iterations: number;
  quality_threshold: number;
  cost_limit_per_enhancement?: number;
  enhancement_strategies: string[];
}

export interface UserPreferences {
  preferred_provider?: string;
  max_cost_per_request: number;
  prioritize_speed: boolean;
  enable_caching: boolean;
  quality_over_cost: boolean;
}

export interface ServerConfig {
  models: {
    classifiers: ModelConfig[];
    enhancers: ModelConfig[];
    fallback_models: ModelConfig[];
  };
  providers: ProviderConfig[];
  categories: Record<string, CategoryConfig>;
  enhancement: EnhancementConfig;
  user_preferences: UserPreferences;
  cache_settings: {
    ttl: number;
    max_size: number;
    enabled: boolean;
  };
  logging: {
    level: string;
    file?: string;
  };
}

export interface TaskCategory {
  name: string;
  confidence: number;
  keywords_matched: string[];
  system_prompt: string;
  priority: number;
}

export interface EnhancementResult {
  original_prompt: string;
  enhanced_prompt: string;
  categories: TaskCategory[];
  model_used: string;
  provider: string;
  estimated_tokens: number;
  estimated_cost: number;
  enhancement_strategies: string[];
  quality_score: number;
  processing_time: number;
}

export interface LLMResponse {
  content: string;
  tokens_used: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  model: string;
  provider: string;
  processing_time: number;
  cached?: boolean;
}

export interface ProviderInterface {
  name: string;
  isAvailable(): boolean;
  generate(prompt: string, options: GenerationOptions): Promise<LLMResponse>;
  estimateTokens(text: string): number;
  estimateCost(inputTokens: number, outputTokens: number): number;
  getAvailableModels(): string[];
}

export interface GenerationOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
  user?: string;
}

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
  hit_count: number;
}

export interface AnalysisResult {
  categories: TaskCategory[];
  complexity_score: number;
  recommended_model: ModelConfig;
  estimated_cost: number;
  confidence: number;
}

export interface ModelCapabilities {
  coding: boolean;
  reasoning: boolean;
  creative_writing: boolean;
  data_analysis: boolean;
  multimodal: boolean;
  function_calling: boolean;
  long_context: boolean;
  max_context_length: number;
}

export interface CostAnalysis {
  total_cost: number;
  cost_breakdown: {
    input_cost: number;
    output_cost: number;
    enhancement_cost: number;
    overhead_cost: number;
  };
  cost_per_token: number;
  efficiency_score: number;
}

export interface PerformanceMetrics {
  response_time: number;
  tokens_per_second: number;
  cache_hit_rate: number;
  error_rate: number;
  cost_efficiency: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  error?: Error;
}

export interface HealthCheck {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time: number;
  error?: string;
  last_check: Date;
}

export interface RateLimitInfo {
  requests_per_minute: number;
  tokens_per_minute: number;
  current_usage: {
    requests: number;
    tokens: number;
  };
  reset_time: Date;
}

export interface ModelDecision {
  selected_model: ModelConfig;
  provider: any; // Will be typed properly when providers are imported
  reasoning: string;
  estimated_cost: number;
  estimated_tokens: number;
  quality_score: number;
  speed_score: number;
  cost_efficiency: number;
}

// Web Scraping Types
export interface WebSearchQuery {
  query: string;
  category: string;
  priority: number;
  search_engines: string[];
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  search_engine: string;
  ranking: number;
  metadata?: {
    published?: string;
    age?: string;
    language?: string;
    family_friendly?: boolean;
  };
}

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  metadata: {
    description?: string;
    keywords?: string[];
    author?: string;
    publish_date?: string;
  };
  word_count: number;
  relevance_score: number;
}

export interface EnhancedPromptWithContext {
  original_prompt: string;
  enhanced_prompt: string;
  web_context: ScrapedContent[];
  search_queries: WebSearchQuery[];
  categories: TaskCategory[];
  processing_metadata: {
    search_time: number;
    scraping_time: number;
    total_time: number;
    urls_processed: number;
    success_rate: number;
  };
}

export interface BrowserConfig {
  headless: boolean;
  proxy?: string;
  user_agent?: string;
  viewport: { width: number; height: number };
  timeout: number;
  stealth_mode: boolean;
}

export interface ScrapingSession {
  browser_id: string;
  search_engine: string;
  requests_count: number;
  last_request_time: number;
  proxy_used: string | undefined;
  user_agent: string;
  session_start: number;
}

export interface AntiDetectionConfig {
  random_delays: { min: number; max: number };
  mouse_movements: boolean;
  scroll_simulation: boolean;
  user_agent_rotation: boolean;
  proxy_rotation: boolean;
  session_cycling: { max_requests: number; cooldown_ms: number };
}

export interface WebScrapingConfig {
  enabled: boolean;
  search_engines: {
    google: { enabled: boolean };
    bing: { enabled: boolean };
    duckduckgo: { enabled: boolean };
  };
  scraping: {
    max_urls_per_query: number;
    timeout_ms: number;
    user_agent: string;
    respect_robots_txt: boolean;
    rate_limit_delay_ms: number;
  };
  content_processing: {
    min_word_count: number;
    max_content_length: number;
    relevance_threshold: number;
  };
} 