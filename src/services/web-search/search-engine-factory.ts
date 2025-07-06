import { SearchResult, AntiDetectionConfig } from '../../types';
import { BrowserPoolManager } from './browser-pool-manager';
import { BraveSearchAPI } from './brave-search-api';
import { Logger } from '../../utils/logger';
import { ConfigurationManager } from '../../config/configuration-manager';

export class SearchEngineFactory {
  private browserManager: BrowserPoolManager;
  private antiDetectionConfig: AntiDetectionConfig;
  private logger: Logger;
  private braveSearchAPI: BraveSearchAPI | null = null;
  private configManager: ConfigurationManager | null = null;

  constructor(configManager?: ConfigurationManager) {
    this.browserManager = new BrowserPoolManager();
    this.logger = new Logger('SearchEngineFactory');
    this.configManager = configManager || null;
    
    this.antiDetectionConfig = {
      random_delays: { min: 2000, max: 5000 },
      mouse_movements: true,
      scroll_simulation: true,
      user_agent_rotation: true,
      proxy_rotation: false,
      session_cycling: { max_requests: 5, cooldown_ms: 60000 }
    };

    this.initializeEngines();
    
    this.logger.info('Search engine factory initialized - Brave API only', {
      scrapingEnginesDisabled: true,
      hasBraveAPI: !!this.braveSearchAPI,
      availableEngines: this.braveSearchAPI ? ['brave-api'] : []
    });
  }

  private initializeEngines(): void {
    try {
      if (this.configManager) {
        const braveApiKey = this.configManager.getBraveApiKey();
        if (braveApiKey) {
          this.braveSearchAPI = new BraveSearchAPI({
            apiKey: braveApiKey,
            timeout: 10000
          });
          this.logger.info('Brave Search API initialized as primary search source');
        } else {
          this.logger.debug('Brave API key not found, using scraping fallbacks only');
        }
      }
      
      this.logger.debug('Search engines initialized', {
        braveAPIAvailable: !!this.braveSearchAPI
      });
    } catch (error) {
      this.logger.error('Failed to initialize search engines', { error });
    }
  }

  async searchSingleEngine(
    engine: string, 
    query: string, 
    maxResults: number = 5
  ): Promise<SearchResult[]> {
    this.logger.debug(`Searching single engine: ${engine}`, { query, maxResults });

    if (engine === 'brave' && this.braveSearchAPI) {
      try {
        const results = await this.braveSearchAPI.search(query, maxResults);
        
        this.logger.info(`Brave API search completed`, {
          engine,
          query,
          resultsCount: results.length
        });

        return results;
      } catch (error) {
        this.logger.error(`Brave API search failed`, {
          engine,
          query,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return [];
      }
    } else {
      this.logger.warn(`Unsupported search engine: ${engine}`);
      return [];
    }
  }

  async searchMultipleEngines(
    query: string, 
    _engines: string[] = ['brave'],
    maxResultsPerEngine: number = 5
  ): Promise<SearchResult[]> {
    this.logger.info(`Multi-engine search disabled - using Brave API only`, {
      query,
      maxResults: maxResultsPerEngine
    });

    if (this.braveSearchAPI) {
      try {
        const results = await this.braveSearchAPI.search(query, maxResultsPerEngine);
        
        this.logger.info(`Brave API search completed`, {
          query,
          resultsCount: results.length
        });

        return results;
      } catch (error) {
        this.logger.error(`Brave API search failed`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return [];
      }
    } else {
      this.logger.error('Brave Search API not available');
      return [];
    }
  }

  async searchWithIntelligentFallback(
    query: string,
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    this.logger.info(`Starting intelligent search with Brave API only`, {
      query,
      maxResults,
      hasBraveAPI: !!this.braveSearchAPI
    });

    if (this.braveSearchAPI) {
      try {
        this.logger.debug('Attempting Brave Search API');
        const braveResults = await this.braveSearchAPI.search(query, maxResults);
        
        if (braveResults.length > 0) {
          this.logger.info('Brave Search API succeeded', {
            resultsCount: braveResults.length
          });
          return braveResults;
        }
        
        this.logger.warn('Brave Search API returned no results');
      } catch (error) {
        this.logger.warn('Brave Search API failed', { error });
      }
    } else {
      this.logger.error('Brave Search API not available and no fallback scrapers enabled');
    }

    this.logger.warn('No search results available - only Brave API is enabled');
    return [];
  }

  async searchWithFallback(
    query: string,
    _primaryEngine: string = 'brave',
    _fallbackEngines: string[] = [],
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    this.logger.info(`Search with fallback disabled - only Brave API available`, {
      query,
      maxResults
    });

    if (this.braveSearchAPI) {
      try {
        const braveResults = await this.braveSearchAPI.search(query, maxResults);
        
        if (braveResults.length > 0) {
          this.logger.info(`Brave API succeeded`, {
            resultsCount: braveResults.length
          });
          return braveResults;
        }
        
        this.logger.warn(`Brave API returned no results`);
      } catch (error) {
        this.logger.warn(`Brave API failed`, { error });
      }
    } else {
      this.logger.error('Brave Search API not available');
    }

    this.logger.warn('No search results available - scraping engines are disabled');
    return [];
  }

  async healthCheckAllEngines(): Promise<Record<string, boolean>> {
    this.logger.info('Performing health check on Brave API');
    
    const healthStatus: Record<string, boolean> = {};
    
    if (this.braveSearchAPI) {
      try {
        const isHealthy = await this.braveSearchAPI.healthCheck();
        healthStatus['brave-api'] = isHealthy;
        
        this.logger.debug(`Health check for brave-api`, { healthy: isHealthy });
      } catch (error) {
        healthStatus['brave-api'] = false;
        this.logger.warn(`Health check failed for brave-api`, { error });
      }
    } else {
      healthStatus['brave-api'] = false;
      this.logger.warn('Brave API not available for health check');
    }
    
    const healthyEngines = Object.values(healthStatus).filter(status => status).length;
    this.logger.info('Health check completed', {
      totalEngines: 1,
      healthyEngines,
      healthStatus
    });
    
    return healthStatus;
  }

  getAvailableEngines(): string[] {
    return this.braveSearchAPI ? ['brave-api'] : [];
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up search engine factory');
    
    try {
      await this.browserManager.cleanupOldSessions(0);
      this.logger.debug('Browser sessions cleaned up');
    } catch (error) {
      this.logger.warn('Error during cleanup', { error });
    }
  }

  updateAntiDetectionConfig(config: Partial<AntiDetectionConfig>): void {
    this.antiDetectionConfig = { ...this.antiDetectionConfig, ...config };
    this.logger.info('Anti-detection configuration updated', { config });
  }
} 