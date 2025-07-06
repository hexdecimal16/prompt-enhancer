import { Page } from 'puppeteer';
import { ScrapedContent } from '../../types';
import { BrowserPoolManager } from '../web-search/browser-pool-manager';
import { HumanBehaviorSimulator } from '../web-search/human-behavior-simulator';
import { Logger } from '../../utils/logger';

export interface ScrapingOptions {
  timeout?: number;
  maxRetries?: number;
  minWordCount?: number;
  maxContentLength?: number;
}

export class StealthContentScraper {
  private browserManager: BrowserPoolManager;
  private behaviorSimulator: HumanBehaviorSimulator;
  private logger: Logger;
  private defaultOptions: ScrapingOptions;

  constructor() {
    this.browserManager = new BrowserPoolManager();
    this.behaviorSimulator = new HumanBehaviorSimulator();
    this.logger = new Logger('StealthContentScraper');
    
    this.defaultOptions = {
      timeout: 30000,
      maxRetries: 2,
      minWordCount: 50,
      maxContentLength: 10000
    };

    this.logger.info('Stealth content scraper initialized');
  }

  async scrapeUrls(urls: string[], options: ScrapingOptions = {}): Promise<ScrapedContent[]> {
    const opts = { ...this.defaultOptions, ...options };
    const results: ScrapedContent[] = [];
    
    this.logger.info(`Starting to scrape ${urls.length} URLs`, { options: opts });

    // Limit to top 3 URLs to avoid excessive scraping
    const urlsToScrape = urls.slice(0, 3);
    
          for (let i = 0; i < urlsToScrape.length; i++) {
        const url = urlsToScrape[i];
        if (!url) continue;
        
        try {
          this.logger.debug(`Scraping URL ${i + 1}/${urlsToScrape.length}: ${url}`);
          
          const content = await this.scrapeUrl(url, opts);
        
                 if (content && content.word_count >= (opts.minWordCount || 50)) {
          results.push(content);
                     this.logger.debug(`Successfully scraped: ${url}`, { 
             wordCount: content.word_count,
             title: (content.title || '').substring(0, 50) + '...'
           });
        } else {
          this.logger.warn(`Scraped content too short or invalid: ${url}`, {
            wordCount: content?.word_count || 0
          });
        }
        
        // Random delay between requests to avoid rate limiting
        if (i < urlsToScrape.length - 1) {
          const delay = 2000 + Math.random() * 3000; // 2-5 seconds
          this.logger.debug(`Inter-scrape delay: ${Math.round(delay)}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        this.logger.warn(`Failed to scrape ${url}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        continue;
      }
    }

    this.logger.info(`Scraping completed`, {
      totalUrls: urlsToScrape.length,
      successfulScrapes: results.length,
      successRate: `${Math.round((results.length / urlsToScrape.length) * 100)}%`
    });

    return results;
  }

  private async scrapeUrl(url: string, options: ScrapingOptions): Promise<ScrapedContent | null> {
    const startTime = Date.now();
    
    try {
      // Validate URL
      new URL(url);
    } catch (error) {
      this.logger.warn(`Invalid URL: ${url}`);
      return null;
    }

    const { browser, sessionId } = await this.browserManager.createStealthBrowser({
      headless: true,
      viewport: { width: 1366, height: 768 },
      timeout: options.timeout || 30000,
      stealth_mode: true
    });

    try {
      const page = await this.browserManager.setupStealthPage(browser, sessionId);
      
      // Set additional headers for content scraping
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive'
      });

      // Navigate with realistic timing
      const navigationDelay = 1000 + Math.random() * 2000; // 1-3 seconds
      await new Promise(resolve => setTimeout(resolve, navigationDelay));
      
      this.logger.debug(`Navigating to: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: options.timeout || 30000
      });

      // Increment request count for session tracking
      this.browserManager.incrementRequestCount(sessionId);

      // Wait for page to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate human reading behavior
      await this.behaviorSimulator.simulateHumanBehavior(page, 'read');

      // Extract content
      const content = await this.extractPageContent(page, url, options);
      
      const processingTime = Date.now() - startTime;
      this.logger.debug(`URL scraped successfully`, {
        url,
        processingTime: `${processingTime}ms`,
        wordCount: content?.word_count || 0
      });

      return content;

    } finally {
      await this.browserManager.closeBrowser(sessionId);
    }
  }

  private async extractPageContent(
    page: Page, 
    url: string, 
    options: ScrapingOptions
  ): Promise<ScrapedContent | null> {
    try {
      const extractedData = await page.evaluate((maxLength: number) => {
        // Remove unwanted elements
        const unwantedSelectors = [
          'nav', 'header', 'footer', 'aside',
          '.ads', '.advertisement', '.ad', '.banner',
          '.sidebar', '.menu', '.navigation', '.nav',
          'script', 'style', 'noscript',
          '.social', '.share', '.sharing',
          '.comments', '.comment-section',
          '.popup', '.modal', '.overlay',
          '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
        ];
        
        unwantedSelectors.forEach(selector => {
          const elements = (globalThis as any).document.querySelectorAll(selector);
          elements.forEach((el: any) => {
            if (el && el.remove) {
              el.remove();
            }
          });
        });

        // Find main content using multiple strategies
        let mainContent = '';
        let title = '';
        let description = '';
        let keywords: string[] = [];

        // Extract title
        title = (globalThis as any).document.title || '';

        // Extract meta description
        const metaDesc = (globalThis as any).document.querySelector('meta[name="description"]');
        if (metaDesc) {
          description = metaDesc.getAttribute('content') || '';
        }

        // Extract meta keywords
        const metaKeywords = (globalThis as any).document.querySelector('meta[name="keywords"]');
        if (metaKeywords) {
          const keywordContent = metaKeywords.getAttribute('content') || '';
          keywords = keywordContent.split(',').map((k: string) => k.trim()).filter((k: string) => k);
        }

        // Content extraction strategies in order of preference
        const contentSelectors = [
          'main',
          'article',
          '[role="main"]',
          '.content',
          '.main-content',
          '.post-content',
          '.entry-content',
          '.article-body',
          '.article-content',
          '.text-content',
          '#content',
          '#main-content',
          '.container .content',
          'div[class*="content"]'
        ];

        // Try each content selector
        for (const selector of contentSelectors) {
          const element = (globalThis as any).document.querySelector(selector);
          if (element && element.textContent && element.textContent.length > 200) {
            mainContent = element.textContent;
            break;
          }
        }

        // Fallback to body content if no main content found
        if (!mainContent || mainContent.length < 100) {
          const bodyElement = (globalThis as any).document.body;
          if (bodyElement) {
            mainContent = bodyElement.textContent || '';
          }
        }

        // Clean up content
        mainContent = mainContent
          .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
          .replace(/\n+/g, ' ') // Replace newlines with space
          .trim();

        // Truncate if too long
        if (mainContent.length > maxLength) {
          mainContent = mainContent.substring(0, maxLength) + '...';
        }

        // Calculate word count
        const wordCount = mainContent ? mainContent.split(/\s+/).filter(word => word.length > 0).length : 0;

        return {
          title: title.trim(),
          content: mainContent,
          description: description.trim(),
          keywords,
          wordCount
        };
      }, options.maxContentLength || 10000);

      if (!extractedData.content || extractedData.wordCount < (options.minWordCount || 50)) {
        this.logger.debug(`Content too short or empty for URL: ${url}`, {
          wordCount: extractedData.wordCount,
          minRequired: options.minWordCount || 50
        });
        return null;
      }

      return {
        url,
        title: extractedData.title || this.extractTitleFromUrl(url),
        content: extractedData.content,
        metadata: {
          description: extractedData.description,
          keywords: extractedData.keywords
        },
        word_count: extractedData.wordCount,
        relevance_score: 0 // Will be calculated later by relevance scorer
      };

    } catch (error) {
      this.logger.error(`Failed to extract content from ${url}`, { error });
      return null;
    }
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
             // Extract meaningful part from path
       const pathParts = pathname.split('/').filter(part => part && part !== 'index.html');
       if (pathParts.length > 0) {
         const lastPart = pathParts[pathParts.length - 1];
         if (lastPart) {
           // Convert kebab-case or snake_case to title case
           return lastPart
             .replace(/[-_]/g, ' ')
             .replace(/\b\w/g, l => l.toUpperCase());
         }
       }
      
      return urlObj.hostname;
    } catch (error) {
      return 'Unknown Title';
    }
  }

  async testScraping(testUrl: string = 'https://example.com'): Promise<boolean> {
    this.logger.info(`Testing content scraping with URL: ${testUrl}`);
    
    try {
      const results = await this.scrapeUrls([testUrl], { minWordCount: 10 });
      const success = results.length > 0;
      
      this.logger.info(`Content scraping test completed`, { 
        success,
        resultCount: results.length
      });
      
      return success;
    } catch (error) {
      this.logger.error('Content scraping test failed', { error });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up content scraper');
    
    try {
      await this.browserManager.cleanupOldSessions(0);
      this.logger.debug('Content scraper cleanup completed');
    } catch (error) {
      this.logger.warn('Error during content scraper cleanup', { error });
    }
  }
} 