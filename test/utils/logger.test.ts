import { Logger } from '../../src/utils/logger';
import { LogLevel } from '../../src/types';

// Mock process.stderr.write to capture output
const originalStderrWrite = process.stderr.write;
let stderrOutput: string[] = [];

beforeEach(() => {
  stderrOutput = [];
  process.stderr.write = jest.fn((str: string) => {
    stderrOutput.push(str);
    return true;
  }) as any;
});

afterEach(() => {
  process.stderr.write = originalStderrWrite;
});

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('TestModule');
  });

  describe('constructor', () => {
    it('should create logger with module name', () => {
      const customLogger = new Logger('CustomModule');
      expect(customLogger).toBeInstanceOf(Logger);
    });
  });

  describe('error', () => {
    it('should log error message with module prefix', () => {
      logger.error('Test error message');
      
      expect(stderrOutput).toHaveLength(1);
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain('[ERROR]');
      expect(logOutput).toContain('[TestModule]');
      expect(logOutput).toContain('Test error message');
    });

    it('should log error with metadata', () => {
      const metadata = { userId: 123, action: 'login' };
      logger.error('User error', metadata);
      
      expect(stderrOutput).toHaveLength(1);
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain('User error');
      expect(logOutput).toContain(JSON.stringify(metadata));
    });
  });

  describe('warn', () => {
    it('should log warning message with correct level', () => {
      logger.warn('Test warning');
      
      expect(stderrOutput).toHaveLength(1);
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain('[WARN]');
      expect(logOutput).toContain('[TestModule]');
      expect(logOutput).toContain('Test warning');
    });

    it('should log warning with metadata', () => {
      const metadata = { retryCount: 3 };
      logger.warn('Retry warning', metadata);
      
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain(JSON.stringify(metadata));
    });
  });

  describe('info', () => {
    it('should log info message with correct level', () => {
      logger.info('Test info');
      
      expect(stderrOutput).toHaveLength(1);
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain('[INFO]');
      expect(logOutput).toContain('[TestModule]');
      expect(logOutput).toContain('Test info');
    });

    it('should log info with metadata', () => {
      const metadata = { status: 'success' };
      logger.info('Operation completed', metadata);
      
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain(JSON.stringify(metadata));
    });
  });

  describe('debug', () => {
    it('should log debug message with correct level', () => {
      logger.debug('Test debug');
      
      expect(stderrOutput).toHaveLength(1);
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain('[DEBUG]');
      expect(logOutput).toContain('[TestModule]');
      expect(logOutput).toContain('Test debug');
    });

    it('should log debug with metadata', () => {
      const metadata = { functionName: 'testFunction' };
      logger.debug('Debug info', metadata);
      
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain(JSON.stringify(metadata));
    });
  });

  describe('verbose', () => {
    it('should log verbose message with correct level', () => {
      logger.verbose('Test verbose');
      
      expect(stderrOutput).toHaveLength(1);
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain('[VERBOSE]');
      expect(logOutput).toContain('[TestModule]');
      expect(logOutput).toContain('Test verbose');
    });

    it('should log verbose with metadata', () => {
      const metadata = { details: 'verbose details' };
      logger.verbose('Verbose message', metadata);
      
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain(JSON.stringify(metadata));
    });
  });

  describe('formatLogEntry', () => {
    it('should format log entry with timestamp and level', () => {
      logger.info('Test message');
      
      const logOutput = stderrOutput[0];
      expect(logOutput).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      expect(logOutput).toContain('[INFO]');
    });

    it('should include error details when error is present', () => {
      const mockError = new Error('Test error');
      mockError.stack = 'Error: Test error\n    at test.js:1:1';
      
      // Access private log method through error method with metadata containing error
      logger.error('Error occurred', { error: mockError });
      
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain('Error occurred');
      expect(logOutput).toContain(JSON.stringify({ error: mockError }));
    });

    it('should handle error without stack trace', () => {
      const mockError = new Error('Test error');
      delete mockError.stack;
      
      logger.error('Error occurred', { error: mockError });
      
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain('Error occurred');
      expect(logOutput).toContain('{}');
    });
  });

  describe('log levels', () => {
    it('should handle all log levels correctly', () => {
      const levels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'verbose'];
      
      levels.forEach((level, index) => {
        switch (level) {
          case 'error':
            logger.error(`Test ${level}`);
            break;
          case 'warn':
            logger.warn(`Test ${level}`);
            break;
          case 'info':
            logger.info(`Test ${level}`);
            break;
          case 'debug':
            logger.debug(`Test ${level}`);
            break;
          case 'verbose':
            logger.verbose(`Test ${level}`);
            break;
        }
        
        expect(stderrOutput[index]).toContain(`[${level.toUpperCase()}]`);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null metadata gracefully', () => {
      logger.info('Test message', null as any);
      
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain('Test message');
      expect(logOutput).not.toContain('null');
    });

    it('should handle undefined metadata gracefully', () => {
      logger.info('Test message', undefined);
      
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain('Test message');
      expect(logOutput).not.toContain('undefined');
    });

    it('should handle complex metadata objects', () => {
      const complexMetadata = {
        nested: { value: 123 },
        array: [1, 2, 3],
        string: 'test',
        boolean: true,
        null: null,
        undefined: undefined
      };
      
      logger.info('Complex metadata test', complexMetadata);
      
      const logOutput = stderrOutput[0];
      expect(logOutput).toContain(JSON.stringify(complexMetadata));
    });

    it('should handle circular references in metadata', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      // Should throw error when stringifying circular object (this is expected JSON behavior)
      expect(() => {
        logger.info('Circular test', circularObj);
      }).toThrow();
    });
  });
}); 