import { SearchResult } from '../../types';
import { Logger } from '../../utils/logger';

interface BraveSearchConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface RateLimitInfo {
  limit: number;
  current: number;
  resetTime?: number;
  lastRequestTime: number;
}

interface BraveWebSearchResponse {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description: string;
      published?: string;
      age?: string;
      language?: string;
      family_friendly?: boolean;
    }>;
  };
  query?: {
    original: string;
    show_strict_warning?: boolean;
    altered?: string;
    spellcheck_off?: boolean;
  };
}

export class BraveSearchAPI {
  private config: BraveSearchConfig;
  private logger: Logger;
  private baseUrl: string;
  private rateLimitInfo: RateLimitInfo;

  constructor(config: BraveSearchConfig) {
    this.config = config;
    this.logger = new Logger('BraveSearchAPI');
    this.baseUrl = config.baseUrl || 'https://api.search.brave.com/res/v1';
    
    // Initialize rate limit info with conservative defaults
    this.rateLimitInfo = {
      limit: 1, // Default to 1 request per second for free plan
      current: 0,
      lastRequestTime: 0
    };
    
    this.logger.info('Brave Search API client initialized', {
      baseUrl: this.baseUrl,
      hasApiKey: !!config.apiKey,
      timeout: config.timeout || 10000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000
    });
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimitInfo.lastRequestTime;
    const minDelayMs = 1000 / this.rateLimitInfo.limit; // Convert rate limit to milliseconds between requests
    
    if (timeSinceLastRequest < minDelayMs) {
      const waitTime = minDelayMs - timeSinceLastRequest;
      this.logger.debug('Rate limit delay applied', { 
        waitTimeMs: waitTime, 
        rateLimit: this.rateLimitInfo.limit 
      });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.rateLimitInfo.lastRequestTime = Date.now();
  }

  private parseRateLimitFromError(errorText: string): void {
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error?.meta) {
        const meta = errorData.error.meta;
        if (meta.rate_limit) {
          this.rateLimitInfo.limit = meta.rate_limit;
          this.logger.info('Updated rate limit info from API response', {
            rateLimit: meta.rate_limit,
            plan: meta.plan,
            quotaCurrent: meta.quota_current,
            quotaLimit: meta.quota_limit
          });
        }
      }
    } catch (error) {
      this.logger.debug('Could not parse rate limit info from error response');
    }
  }

  private async makeRequestWithRetry<T>(requestFn: () => Promise<T>): Promise<T> {
    const maxRetries = this.config.maxRetries || 3;
    const baseDelay = this.config.retryDelay || 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.waitForRateLimit();
        return await requestFn();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Check if it's a rate limit error
        if (errorMessage.includes('429') && errorMessage.includes('RATE_LIMITED')) {
          this.parseRateLimitFromError(errorMessage);
          
          if (attempt < maxRetries) {
            // Exponential backoff with jitter
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            this.logger.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
              attempt,
              delay,
              nextAttempt: attempt + 1
            });
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // If it's not a rate limit error or we've exhausted retries, throw
        throw error;
      }
    }
    
    throw new Error(`Request failed after ${maxRetries} attempts`);
  }

  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    this.logger.info(`Starting Brave API search for query: "${query}"`, { maxResults });

    if (!this.config.apiKey) {
      throw new Error('Brave Search API key is required. Please set the BRAVE_API_KEY environment variable or configure it in your MCP settings.');
    }

    return this.makeRequestWithRetry(async () => {
      const searchUrl = new URL(`${this.baseUrl}/web/search`);
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('count', Math.min(maxResults, 20).toString()); // Brave API max is 20
      searchUrl.searchParams.set('result_filter', 'web');
      searchUrl.searchParams.set('safesearch', 'moderate');
      searchUrl.searchParams.set('search_lang', 'en');
      searchUrl.searchParams.set('ui_lang', 'en-US');
      searchUrl.searchParams.set('country', 'us');

      this.logger.debug('Making Brave API request', { 
        url: searchUrl.toString(),
        query 
      });

      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.config.apiKey,
          'User-Agent': 'Mozilla/5.0 (compatible; PromptEnhancer/1.0; +https://github.com/your-repo)'
        },
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Brave API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as BraveWebSearchResponse;

      this.logger.debug('Brave API response received', {
        hasWebResults: !!data.web?.results,
        resultsCount: data.web?.results?.length || 0,
        originalQuery: data.query?.original,
        alteredQuery: data.query?.altered
      });

      const searchResults: SearchResult[] = [];

      if (data.web?.results) {
        for (let i = 0; i < data.web.results.length && i < maxResults; i++) {
          const result = data.web.results[i];
          
          // Skip if result is undefined or missing required fields
          if (!result || !result.url || !result.title) {
            this.logger.debug('Skipping invalid result', { result });
            continue;
          }

          // Clean and validate URL
          let cleanUrl: string;
          try {
            const urlObj = new URL(result.url);
            cleanUrl = urlObj.href;
          } catch (error) {
            this.logger.debug('Skipping result with invalid URL', { url: result.url });
            continue;
          }

          const searchResult: SearchResult = {
            url: cleanUrl,
            title: result.title.trim(),
            snippet: (result.description || '').trim(),
            search_engine: 'brave-api',
            ranking: i + 1
          };

          // Add metadata if any values are present
          if (result.published || result.age || result.language || result.family_friendly !== undefined) {
            searchResult.metadata = {};
            if (result.published) searchResult.metadata.published = result.published;
            if (result.age) searchResult.metadata.age = result.age;
            if (result.language) searchResult.metadata.language = result.language;
            if (result.family_friendly !== undefined) searchResult.metadata.family_friendly = result.family_friendly;
          }

          searchResults.push(searchResult);
        }
      }

      this.logger.info('Brave API search completed successfully', {
        query,
        resultsFound: data.web?.results?.length || 0,
        resultsReturned: searchResults.length,
        processingTime: 'N/A' // API doesn't provide this
      });

      return searchResults;
    });
  }

  async healthCheck(): Promise<boolean> {
    this.logger.debug('Performing Brave API health check');

    try {
      const results = await this.search('test health check', 1);
      const isHealthy = results.length > 0;
      
      this.logger.info('Brave API health check completed', {
        healthy: isHealthy,
        resultsCount: results.length
      });

      return isHealthy;
    } catch (error) {
      this.logger.warn('Brave API health check failed', { error });
      return false;
    }
  }

  get name(): string {
    return 'Brave Search API';
  }

  async cleanup(): Promise<void> {
    this.logger.debug('Brave API cleanup completed (no resources to clean)');
  }
} 