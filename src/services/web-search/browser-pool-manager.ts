import { Browser, Page } from 'puppeteer';
const UserAgent = require('user-agents');
import { BrowserConfig, ScrapingSession } from '../../types';
import { Logger } from '../../utils/logger';

interface EnvironmentInfo {
  platform: string;
  arch: string;
  isArm64Mac: boolean;
  isLinux: boolean;
  isWindows: boolean;
  isMac: boolean;
}

interface BrowserStrategy {
  name: string;
  executablePath?: string;
  launchOptions: any;
  usesStealth: boolean;
}

export class BrowserPoolManager {
  private browsers: Map<string, Browser> = new Map();
  private sessions: Map<string, ScrapingSession> = new Map();
  private logger: Logger;
  private userAgents: string[];
  private environmentInfo: EnvironmentInfo;
  private browserStrategies: BrowserStrategy[];

  constructor() {
    this.logger = new Logger('BrowserPoolManager');
    this.userAgents = this.generateUserAgents();
    this.environmentInfo = this.detectEnvironment();
    this.browserStrategies = this.configureBrowserStrategies();
    
    this.logger.info('Environment-intelligent browser pool manager initialized', {
      platform: this.environmentInfo.platform,
      arch: this.environmentInfo.arch,
      strategies: this.browserStrategies.length
    });
  }

  private detectEnvironment(): EnvironmentInfo {
    const platform = process.platform;
    const arch = process.arch;
    
    const environmentInfo: EnvironmentInfo = {
      platform,
      arch,
      isArm64Mac: platform === 'darwin' && arch === 'arm64',
      isLinux: platform === 'linux',
      isWindows: platform === 'win32',
      isMac: platform === 'darwin'
    };

    this.logger.debug('Environment detected', environmentInfo);
    return environmentInfo;
  }

  private configureBrowserStrategies(): BrowserStrategy[] {
    const strategies: BrowserStrategy[] = [];

    if (this.environmentInfo.isArm64Mac) {
      // ARM64 Mac strategies (ordered by preference)
      strategies.push({
        name: 'ARM64 Mac - Basic Puppeteer',
        launchOptions: {
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-web-security',
            '--disable-features=TranslateUI,VizDisplayCompositor',
            '--enable-logging',
            '--log-level=0'
          ]
        },
        usesStealth: false
      });

      strategies.push({
        name: 'ARM64 Mac - System Chrome',
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        launchOptions: {
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process']
        },
        usesStealth: false
      });
    }

    if (this.environmentInfo.isLinux) {
      // Linux strategies
      strategies.push({
        name: 'Linux - Basic Puppeteer',
        launchOptions: {
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--remote-debugging-port=0',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        },
        usesStealth: false
      });

      strategies.push({
        name: 'Linux - System Chromium',
        executablePath: '/usr/bin/chromium-browser',
        launchOptions: {
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        usesStealth: false
      });
    }

    if (this.environmentInfo.isWindows) {
      // Windows strategies
      strategies.push({
        name: 'Windows - Basic Puppeteer',
        launchOptions: {
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ]
        },
        usesStealth: false
      });
    }

    if (this.environmentInfo.isMac && !this.environmentInfo.isArm64Mac) {
      // Intel Mac strategies
      strategies.push({
        name: 'Intel Mac - Standard Puppeteer',
        launchOptions: {
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ]
        },
        usesStealth: false
      });
    }

    // Universal fallback strategy
    strategies.push({
      name: 'Universal Fallback - Minimal Config',
      launchOptions: {
        headless: 'new',
        args: ['--no-sandbox']
      },
      usesStealth: false
    });

    return strategies;
  }

  async createStealthBrowser(config: BrowserConfig): Promise<{ browser: Browser; sessionId: string }> {
    this.logger.debug('Creating environment-intelligent browser instance', { 
      config,
      environment: this.environmentInfo 
    });

    const errors: Error[] = [];

    // Try each strategy in order
    for (const strategy of this.browserStrategies) {
      try {
        this.logger.debug(`Attempting strategy: ${strategy.name}`);
        
        const browser = await this.launchBrowserWithStrategy(strategy, config);
        
        const sessionId = this.generateSessionId();
        const session: ScrapingSession = {
          browser_id: sessionId,
          search_engine: '',
          requests_count: 0,
          last_request_time: Date.now(),
          proxy_used: config.proxy || undefined,
          user_agent: config.user_agent || this.getRandomUserAgent(),
          session_start: Date.now()
        };

        this.browsers.set(sessionId, browser);
        this.sessions.set(sessionId, session);

        this.logger.info('Environment-intelligent browser created successfully', { 
          sessionId, 
          strategy: strategy.name,
          headless: config.headless,
          userAgent: session.user_agent.substring(0, 50) + '...'
        });

        return { browser, sessionId };

      } catch (error) {
        this.logger.debug(`Strategy failed: ${strategy.name}`, { error });
        errors.push(error as Error);
        continue;
      }
    }

    // All strategies failed
    this.logger.error('All browser strategies failed', { 
      strategiesAttempted: this.browserStrategies.length,
      errors: errors.map(e => e.message)
    });
    
    throw new Error(`Browser creation failed on ${this.environmentInfo.platform}/${this.environmentInfo.arch}. All ${this.browserStrategies.length} strategies attempted. Last error: ${errors[errors.length - 1]?.message || 'Unknown error'}`);
  }

  private async launchBrowserWithStrategy(strategy: BrowserStrategy, config: BrowserConfig): Promise<Browser> {
    const puppeteer = require('puppeteer');
    
    // Merge strategy options with config
    const launchOptions = {
      ...strategy.launchOptions,
      headless: config.headless ? strategy.launchOptions.headless : false,
      defaultViewport: {
        width: config.viewport.width,
        height: config.viewport.height,
        isMobile: false,
        hasTouch: false
      },
      timeout: config.timeout
    };

    // Add executable path if specified
    if (strategy.executablePath) {
      // Check if executable exists
      try {
        const fs = require('fs');
        if (fs.existsSync(strategy.executablePath)) {
          launchOptions.executablePath = strategy.executablePath;
          this.logger.debug('Using custom executable path', { path: strategy.executablePath });
        } else {
          this.logger.debug('Custom executable not found, using default', { path: strategy.executablePath });
        }
      } catch (error) {
        this.logger.debug('Error checking executable path', { error });
      }
    }

    // Add proxy if specified
    if (config.proxy) {
      launchOptions.args.push(`--proxy-server=${config.proxy}`);
    }

    this.logger.debug('Launching browser with merged options', {
      strategy: strategy.name,
      launchOptions: {
        ...launchOptions,
        args: launchOptions.args?.slice(0, 5) // Show only first 5 args for brevity
      }
    });

    return await puppeteer.launch(launchOptions);
  }

  async setupStealthPage(browser: Browser, sessionId: string): Promise<Page> {
    this.logger.debug('Setting up environment-optimized page', { sessionId });

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const page = await browser.newPage();

      // Set user agent
      await page.setUserAgent(session.user_agent);
      this.logger.debug('User agent set', { userAgent: session.user_agent.substring(0, 50) + '...' });

      // Set viewport
      await page.setViewport({
        width: 1366,
        height: 768
      });
      this.logger.debug('Viewport set', { width: 1366, height: 768 });

      // Set basic headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });

      // Add basic stealth measures if not problematic for this environment
      if (!this.environmentInfo.isArm64Mac) {
        try {
          await page.evaluateOnNewDocument(() => {
            // Basic webdriver detection removal
            Object.defineProperty(navigator, 'webdriver', { 
              get: () => undefined 
            });
          });
        } catch (error) {
          this.logger.debug('Could not add stealth measures', { error });
        }
      }

      this.logger.debug('Environment-optimized page setup completed', { sessionId });
      return page;
    } catch (error) {
      this.logger.error('Failed to setup page', { error, sessionId });
      throw new Error(`Page setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async closeBrowser(sessionId: string): Promise<void> {
    this.logger.debug('Closing browser', { sessionId });

    try {
      const browser = this.browsers.get(sessionId);
      const session = this.sessions.get(sessionId);

      if (browser) {
        await browser.close();
        this.browsers.delete(sessionId);
        this.logger.debug('Browser closed successfully', { sessionId });
      }

      if (session) {
        this.sessions.delete(sessionId);
        const sessionDuration = Date.now() - session.session_start;
        this.logger.info('Session ended', { 
          sessionId, 
          duration: sessionDuration,
          requestCount: session.requests_count
        });
      }
    } catch (error) {
      this.logger.error('Error closing browser', { error, sessionId });
    }
  }

  incrementRequestCount(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.requests_count++;
      session.last_request_time = Date.now();
      this.logger.debug('Request count incremented', { 
        sessionId, 
        requestCount: session.requests_count 
      });
    }
  }

  getSessionInfo(sessionId: string): ScrapingSession | undefined {
    return this.sessions.get(sessionId);
  }

  async cleanupOldSessions(maxAgeMs: number = 300000): Promise<void> { // 5 minutes default
    this.logger.debug('Cleaning up old sessions', { maxAgeMs });
    
    const now = Date.now();
    const oldSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.last_request_time > maxAgeMs) {
        oldSessions.push(sessionId);
      }
    }

    for (const sessionId of oldSessions) {
      this.logger.debug('Cleaning up old session', { sessionId });
      await this.closeBrowser(sessionId);
    }

    if (oldSessions.length > 0) {
      this.logger.info('Old sessions cleaned up', { count: oldSessions.length });
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private getRandomUserAgent(): string {
    const randomIndex = Math.floor(Math.random() * this.userAgents.length);
    return this.userAgents[randomIndex] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  private generateUserAgents(): string[] {
    this.logger.debug('Generated user agents', { count: 10 });
    
    // Generate realistic user agents for different platforms
    const userAgents: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      const userAgent = new UserAgent();
      const agentString = userAgent.toString();
      if (agentString && typeof agentString === 'string') {
        userAgents.push(agentString);
      }
    }
    
    // Add fallback user agents if generation failed
    if (userAgents.length === 0) {
      userAgents.push(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
    }
    
    return userAgents;
  }

  // Health check method for monitoring
  async healthCheck(): Promise<{ status: string; environment: EnvironmentInfo; strategies: number; activeSessions: number }> {
    return {
      status: 'healthy',
      environment: this.environmentInfo,
      strategies: this.browserStrategies.length,
      activeSessions: this.sessions.size
    };
  }

  // Get environment information for debugging
  getEnvironmentInfo(): EnvironmentInfo {
    return this.environmentInfo;
  }

  // Get available strategies for debugging
  getAvailableStrategies(): BrowserStrategy[] {
    return this.browserStrategies.map(strategy => ({
      ...strategy,
      launchOptions: { ...strategy.launchOptions } // Clone to avoid modification
    }));
  }
} 