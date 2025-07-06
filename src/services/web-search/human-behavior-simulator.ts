import { Page } from 'puppeteer';
import { Logger } from '../../utils/logger';

export class HumanBehaviorSimulator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('HumanBehaviorSimulator');
  }

  async simulateHumanBehavior(page: Page, action: 'search' | 'scroll' | 'click' | 'read'): Promise<void> {
    this.logger.debug(`Simulating human behavior: ${action}`);
    
    try {
      switch (action) {
        case 'search':
          await this.simulateSearchBehavior(page);
          break;
        case 'scroll':
          await this.simulateScrolling(page);
          break;
        case 'click':
          await this.simulateClick(page);
          break;
        case 'read':
          await this.simulateReading(page);
          break;
      }
    } catch (error) {
      this.logger.warn(`Failed to simulate ${action} behavior:`, { error });
    }
  }

  private async simulateSearchBehavior(page: Page): Promise<void> {
    this.logger.debug('Simulating search behavior');
    
    // Simulate mouse movement to search box
    await this.randomMouseMovement(page);
    await this.randomDelay(200, 500);
    
    // Add slight pause before typing (human hesitation)
    await this.randomDelay(300, 800);
  }

  private async simulateScrolling(page: Page): Promise<void> {
    this.logger.debug('Simulating scrolling behavior');
    
    try {
      const scrollHeight = await page.evaluate(() => (globalThis as any).document.body.scrollHeight);
      const viewportHeight = await page.evaluate(() => (globalThis as any).window.innerHeight);
      
      if (scrollHeight <= viewportHeight) {
        this.logger.debug('Page too short for scrolling');
        return;
      }

      // Random number of scroll actions (1-4)
      const scrollActions = Math.floor(Math.random() * 4) + 1;
      
      for (let i = 0; i < scrollActions; i++) {
        // Random scroll distance (realistic human scrolling)
        const scrollDistance = Math.random() * 300 + 100; // 100-400px
        const currentY = await page.evaluate(() => (globalThis as any).window.scrollY);
        const targetY = Math.min(currentY + scrollDistance, scrollHeight - viewportHeight);
        
        await page.evaluate((y: number) => {
          (globalThis as any).window.scrollTo({
            top: y,
            behavior: 'smooth'
          });
        }, targetY);
        
        // Random delay between scrolls (human reading time)
        await this.randomDelay(800, 2000);
      }
    } catch (error) {
      this.logger.warn('Error during scroll simulation:', { error });
    }
  }

  private async simulateClick(page: Page): Promise<void> {
    this.logger.debug('Simulating click behavior');
    
    // Add slight mouse movement before clicking
    await this.randomMouseMovement(page);
    await this.randomDelay(100, 300);
  }

  private async simulateReading(page: Page): Promise<void> {
    this.logger.debug('Simulating reading behavior');
    
    // Simulate human reading time (2-5 seconds)
    const readingTime = Math.random() * 3000 + 2000;
    
    // Add some micro-scrolls during reading
    const microScrolls = Math.floor(readingTime / 1000);
    
    for (let i = 0; i < microScrolls; i++) {
      await this.randomDelay(800, 1200);
      
      // Small scroll movements
      const smallScroll = Math.random() * 50 + 10; // 10-60px
      await page.evaluate((scroll: number) => {
        (globalThis as any).window.scrollBy(0, scroll);
      }, smallScroll);
    }
  }

  private async randomMouseMovement(page: Page): Promise<void> {
    try {
      const viewport = page.viewport();
      if (!viewport) return;

      // Random mouse movement within viewport
      const x = Math.random() * viewport.width * 0.8 + viewport.width * 0.1; // Stay within 10-90% of width
      const y = Math.random() * viewport.height * 0.8 + viewport.height * 0.1; // Stay within 10-90% of height
      
      await page.mouse.move(x, y);
      this.logger.debug(`Mouse moved to (${Math.round(x)}, ${Math.round(y)})`);
    } catch (error) {
      this.logger.warn('Error during mouse movement:', { error });
    }
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    this.logger.debug(`Random delay: ${Math.round(delay)}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async simulateTyping(page: Page, text: string, inputSelector?: string): Promise<void> {
    this.logger.debug(`Simulating typing: "${text.substring(0, 20)}..."`);
    
    try {
      if (inputSelector) {
        await page.focus(inputSelector);
        await this.randomDelay(200, 500);
      }

      // Type with human-like delays between keystrokes
      for (const char of text) {
        await page.keyboard.type(char, { 
          delay: Math.random() * 100 + 50 // 50-150ms between keystrokes
        });
      }
      
      this.logger.debug('Typing simulation completed');
    } catch (error) {
      this.logger.warn('Error during typing simulation:', { error });
    }
  }

  async simulatePageLoad(page: Page): Promise<void> {
    this.logger.debug('Simulating page load behavior');
    
    try {
      // Wait for initial load
      await this.randomDelay(1000, 2000);
      
      // Simulate user looking around the page
      await this.randomMouseMovement(page);
      await this.randomDelay(500, 1000);
      
      // Light scrolling to check page content
      await this.simulateScrolling(page);
      
      this.logger.debug('Page load simulation completed');
    } catch (error) {
      this.logger.warn('Error during page load simulation:', { error });
    }
  }
} 