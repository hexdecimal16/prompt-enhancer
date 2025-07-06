import { EnhancedPromptWithContext, ScrapedContent, WebSearchQuery, TaskCategory } from '../types';
import { EnhancedTaskCategorizer } from './enhanced-task-categorizer';
import { SearchEngineFactory } from '../services/web-search/search-engine-factory';
import { StealthContentScraper } from '../services/web-scraping/stealth-content-scraper';
import { PromptEnhancer, EnhancementOptions } from './prompt-enhancer';
import { Logger } from '../utils/logger';

export interface EnhancedPromptOptions extends EnhancementOptions {
  enable_web_search?: boolean;
  max_search_results?: number;
  max_scraped_content?: number;
}

export class EnhancedPromptService {
  private taskCategorizer: EnhancedTaskCategorizer;
  private promptEnhancer: PromptEnhancer;
  private searchFactory: SearchEngineFactory;
  private contentScraper: StealthContentScraper;
  private logger: Logger;

  constructor(
    taskCategorizer: EnhancedTaskCategorizer,
    promptEnhancer: PromptEnhancer,
    configManager?: any // ConfigurationManager - made optional for backward compatibility
  ) {
    this.taskCategorizer = taskCategorizer;
    this.promptEnhancer = promptEnhancer;
    this.searchFactory = new SearchEngineFactory(configManager);
    this.contentScraper = new StealthContentScraper();
    this.logger = new Logger('EnhancedPromptService');
    
    this.logger.info('Enhanced prompt service initialized', {
      hasBraveAPIConfig: configManager?.getBraveApiKey() ? true : false
    });
  }

  async enhancePromptWithWebContext(
    originalPrompt: string,
    options: EnhancedPromptOptions = {}
  ): Promise<EnhancedPromptWithContext> {
    const startTime = Date.now();
    
    this.logger.info('Starting enhanced prompt processing with web context', {
      promptPreview: originalPrompt.substring(0, 100) + '...',
      enableWebSearch: options.enable_web_search !== false // Default to true
    });

    try {
      // Step 1: Categorize and generate search queries
      const categorization = await this.taskCategorizer.categorizeTaskWithWebSearch(originalPrompt);
      
      let webContext: ScrapedContent[] = [];
      let processingMetadata = {
        search_time: 0,
        scraping_time: 0,
        total_time: 0,
        urls_processed: 0,
        success_rate: 0
      };

      // Step 2: Execute web searches if enabled and queries are available
      if (options.enable_web_search !== false && categorization.suggested_search_queries.length > 0) {
        this.logger.info('Executing web search and content scraping', {
          searchQueries: categorization.suggested_search_queries.length
        });
        
        const searchAndScrapeResult = await this.searchAndScrapeContent(
          categorization.suggested_search_queries,
          options
        );
        
        webContext = searchAndScrapeResult.content;
        processingMetadata = searchAndScrapeResult.metadata;
      } else if (options.enable_web_search !== false) {
        // Fallback: Generate basic search queries from the original prompt
        this.logger.info('No search queries generated, creating fallback queries from prompt');
        
        const fallbackQueries = this.generateFallbackQueriesFromPrompt(originalPrompt);
        
        if (fallbackQueries.length > 0) {
          this.logger.info('Executing web search with fallback queries', {
            searchQueries: fallbackQueries.length
          });
          
          const searchAndScrapeResult = await this.searchAndScrapeContent(
            fallbackQueries,
            options
          );
          
          webContext = searchAndScrapeResult.content;
          processingMetadata = searchAndScrapeResult.metadata;
        } else {
          this.logger.debug('Web search disabled or no search queries generated');
        }
      } else {
        this.logger.debug('Web search disabled or no search queries generated');
      }

      // Step 3: Enhance prompt with or without web context
      const enhancedPrompt = await this.enhancePromptWithContext(
        originalPrompt,
        categorization.categories,
        webContext,
        options
      );

      processingMetadata.total_time = Date.now() - startTime;

      const result: EnhancedPromptWithContext = {
        original_prompt: originalPrompt,
        enhanced_prompt: enhancedPrompt,
        web_context: webContext,
        search_queries: categorization.suggested_search_queries,
        categories: categorization.categories,
        processing_metadata: processingMetadata
      };

      this.logger.info('Enhanced prompt processing completed', {
        totalTime: `${processingMetadata.total_time}ms`,
        webContextItems: webContext.length,
        searchQueries: categorization.suggested_search_queries.length,
        categories: categorization.categories.length
      });

      return result;
    } catch (error) {
      this.logger.error('Enhanced prompt processing failed', { error });
      
      // Fallback to basic enhancement without web context
      try {
        const categories = await this.taskCategorizer.categorizeTask(originalPrompt);
        const basicEnhancedPrompt = await this.enhancePromptWithContext(
          originalPrompt,
          categories,
          [],
          options
        );

        return {
          original_prompt: originalPrompt,
          enhanced_prompt: basicEnhancedPrompt,
          web_context: [],
          search_queries: [],
          categories,
          processing_metadata: {
            search_time: 0,
            scraping_time: 0,
            total_time: Date.now() - startTime,
            urls_processed: 0,
            success_rate: 0
          }
        };
      } catch (fallbackError) {
        this.logger.error('Fallback enhancement also failed', { fallbackError });
        
        // Ultimate fallback - return original prompt
        return {
          original_prompt: originalPrompt,
          enhanced_prompt: originalPrompt,
          web_context: [],
          search_queries: [],
          categories: [],
          processing_metadata: {
            search_time: 0,
            scraping_time: 0,
            total_time: Date.now() - startTime,
            urls_processed: 0,
            success_rate: 0
          }
        };
      }
    }
  }

  private async searchAndScrapeContent(
    searchQueries: WebSearchQuery[],
    options: EnhancedPromptOptions
  ): Promise<{
    content: ScrapedContent[];
    metadata: {
      search_time: number;
      scraping_time: number;
      total_time: number;
      urls_processed: number;
      success_rate: number;
    };
  }> {
    const searchStartTime = Date.now();
    const maxResults = options.max_search_results || 5;
    const allUrls: string[] = [];

    this.logger.debug('Starting web search phase', { 
      searchQueries: searchQueries.length,
      maxResults
    });

    // Execute searches for each query
    for (const searchQuery of searchQueries.slice(0, 2)) { // Limit to 2 queries
      try {
        this.logger.debug(`Executing search: "${searchQuery.query}"`);
        
        const searchResults = await this.searchFactory.searchWithIntelligentFallback(
          searchQuery.query,
          maxResults
        );
        
        const urls = searchResults.map(result => result.url);
        allUrls.push(...urls);
        
        this.logger.debug(`Search completed`, {
          query: searchQuery.query,
          resultsFound: searchResults.length
        });
      } catch (error) {
        this.logger.warn(`Search failed for query: "${searchQuery.query}"`, { error });
      }
    }

    const searchTime = Date.now() - searchStartTime;

    // Remove duplicates and limit URLs
    const uniqueUrls = [...new Set(allUrls)].slice(0, options.max_scraped_content || 3);
    
    this.logger.debug('Starting content scraping phase', { 
      totalUrls: uniqueUrls.length 
    });

    const scrapingStartTime = Date.now();
    
    // Scrape content from URLs
    const scrapedContent = await this.contentScraper.scrapeUrls(uniqueUrls, {
      minWordCount: 50,
      maxContentLength: 5000,
      timeout: 20000
    });

    const scrapingTime = Date.now() - scrapingStartTime;

    // Calculate relevance scores (simple implementation)
    const enrichedContent = scrapedContent.map(content => ({
      ...content,
      relevance_score: this.calculateSimpleRelevance(content)
    })).sort((a, b) => b.relevance_score - a.relevance_score);

    const successRate = uniqueUrls.length > 0 ? enrichedContent.length / uniqueUrls.length : 0;

    this.logger.info('Search and scrape phase completed', {
      searchTime: `${searchTime}ms`,
      scrapingTime: `${scrapingTime}ms`,
      urlsProcessed: uniqueUrls.length,
      contentObtained: enrichedContent.length,
      successRate: `${Math.round(successRate * 100)}%`
    });

    return {
      content: enrichedContent,
      metadata: {
        search_time: searchTime,
        scraping_time: scrapingTime,
        total_time: searchTime + scrapingTime,
        urls_processed: uniqueUrls.length,
        success_rate: successRate
      }
    };
  }

  private async enhancePromptWithContext(
    originalPrompt: string,
    categories: TaskCategory[],
    webContext: ScrapedContent[],
    options: EnhancementOptions
  ): Promise<string> {
    try {
      if (webContext.length > 0) {
        // Create enhanced prompt with web context
        const contextualPrompt = this.createContextualPrompt(originalPrompt, webContext);
        
        this.logger.debug('Enhancing prompt with web context', {
          webContextItems: webContext.length,
          contextualPromptLength: contextualPrompt.length
        });
        
        const enhancementResult = await this.promptEnhancer.enhancePrompt(
          contextualPrompt,
          categories,
          options
        );
        
        return enhancementResult.enhanced_prompt;
      } else {
        // Basic enhancement without web context
        this.logger.debug('Enhancing prompt without web context');
        
        const enhancementResult = await this.promptEnhancer.enhancePrompt(
          originalPrompt,
          categories,
          options
        );
        
        return enhancementResult.enhanced_prompt;
      }
    } catch (error) {
      this.logger.warn('Prompt enhancement failed, returning original', { error });
      return originalPrompt;
    }
  }

  private createContextualPrompt(originalPrompt: string, webContext: ScrapedContent[]): string {
    if (webContext.length === 0) {
      return originalPrompt;
    }

    let contextualPrompt = `${originalPrompt}\n\n**Additional Context from Recent Sources:**\n\n`;
    
    webContext.slice(0, 3).forEach((content, index) => {
      const summary = content.content.length > 500 
        ? content.content.substring(0, 500) + '...'
        : content.content;
        
      contextualPrompt += `**Source ${index + 1}: ${content.title}**\n`;
      contextualPrompt += `URL: ${content.url}\n`;
      contextualPrompt += `Content: ${summary}\n\n`;
    });

    contextualPrompt += `Please use this additional context to provide a more comprehensive and up-to-date response.`;
    
    return contextualPrompt;
  }

  private calculateSimpleRelevance(content: ScrapedContent): number {
    let score = 0;
    
    // Base score from word count (more content = potentially more valuable)
    score += Math.min(content.word_count / 1000, 1) * 0.3;
    
    // Bonus for having good metadata
    if (content.metadata.description) score += 0.2;
    if (content.metadata.keywords && content.metadata.keywords.length > 0) score += 0.1;
    
    // Bonus for recent/authoritative sources (simple heuristics)
    const url = content.url.toLowerCase();
    if (url.includes('github.com') || url.includes('stackoverflow.com')) score += 0.2;
    if (url.includes('docs.') || url.includes('documentation')) score += 0.15;
    if (url.includes('blog') || url.includes('medium.com')) score += 0.1;
    
    // Penalty for very short content
    if (content.word_count < 100) score *= 0.5;
    
    return Math.min(score, 1.0);
  }

  private generateFallbackQueriesFromPrompt(prompt: string): WebSearchQuery[] {
    const queries: WebSearchQuery[] = [];
    const currentYear = new Date().getFullYear();
    
    // Extract key terms from the prompt
    const words = prompt.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
    
    if (words.length === 0) return queries;
    
    // Create basic search queries
    const keyTerms = words.slice(0, 3).join(' ');
    
    // Query 1: Direct search with current year
    if (keyTerms) {
      queries.push({
        query: `${keyTerms} ${currentYear} latest`,
        category: 'general',
        priority: 1,
        search_engines: ['brave']
      });
    }
    
    // Query 2: Best practices or documentation search
    if (keyTerms) {
      queries.push({
        query: `${keyTerms} best practices documentation ${currentYear}`,
        category: 'general',
        priority: 2,
        search_engines: ['brave']
      });
    }
    
    this.logger.debug('Generated fallback search queries', {
      originalPrompt: prompt.substring(0, 100) + '...',
      keyTerms,
      queriesGenerated: queries.length
    });
    
    return queries;
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'];
    return stopWords.includes(word);
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, boolean>;
  }> {
    this.logger.info('Performing health check on enhanced prompt service');
    
    const components: Record<string, boolean> = {};
    
    try {
      // Test search engine health
      const searchHealth = await this.searchFactory.healthCheckAllEngines();
      components['search_engines'] = Object.values(searchHealth).some(status => status);
      
      // Test content scraper
      components['content_scraper'] = await this.contentScraper.testScraping();
      
      // Test basic categorization
      try {
        await this.taskCategorizer.categorizeTask('test prompt');
        components['task_categorizer'] = true;
      } catch {
        components['task_categorizer'] = false;
      }
      
      const healthyComponents = Object.values(components).filter(status => status).length;
      const totalComponents = Object.keys(components).length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyComponents === totalComponents) {
        status = 'healthy';
      } else if (healthyComponents > 0) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
      
      this.logger.info('Health check completed', {
        status,
        healthyComponents: `${healthyComponents}/${totalComponents}`,
        components
      });
      
      return { status, components };
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return {
        status: 'unhealthy',
        components: {}
      };
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up enhanced prompt service');
    
    try {
      await Promise.all([
        this.searchFactory.cleanup(),
        this.contentScraper.cleanup()
      ]);
      
      this.logger.debug('Enhanced prompt service cleanup completed');
    } catch (error) {
      this.logger.warn('Error during cleanup', { error });
    }
  }
} 