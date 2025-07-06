import { LogLevel, LogEntry } from '../types';

export class Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message: `[${this.module}] ${message}`,
      ...(metadata && { metadata }),
      ...(error && { error })
    };

    const logMessage = this.formatLogEntry(entry);

    // Always write logs to stderr so we don't interfere with MCP's
    // JSON-over-stdout protocol.
    switch (level) {
      case 'error':
        process.stderr.write(`${logMessage}\n`);
        break;
      case 'warn':
      case 'info':
      case 'debug':
      case 'verbose':
      default:
        // Coerce all non-error levels to stderr as well.
        process.stderr.write(`${logMessage}\n`);
        break;
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    let message = `${timestamp} [${entry.level.toUpperCase()}] ${entry.message}`;
    
    if (entry.metadata) {
      message += ` ${JSON.stringify(entry.metadata)}`;
    }
    
    if (entry.error) {
      message += ` Error: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\nStack: ${entry.error.stack}`;
      }
    }
    
    return message;
  }

  public error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata);
  }

  public warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  public info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  public debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  public verbose(message: string, metadata?: Record<string, any>): void {
    this.log('verbose', message, metadata);
  }
}
