/**
 * Frontend Logger Utility
 * Structured logging for client-side debugging and error tracking
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  bufferSize: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: 'color: #6b7280',
  info: 'color: #3b82f6',
  warn: 'color: #f59e0b',
  error: 'color: #ef4444',
};

class FrontendLogger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    const isDev = import.meta.env.DEV;
    
    this.config = {
      minLevel: isDev ? 'debug' : 'warn',
      enableConsole: true,
      enableRemote: !isDev, // Enable remote logging in production
      remoteEndpoint: import.meta.env.VITE_LOG_ENDPOINT,
      bufferSize: 50,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  private writeToConsole(entry: LogEntry) {
    if (!this.config.enableConsole) return;

    const { level, message, timestamp, context, error } = entry;
    const color = LOG_COLORS[level];
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    console.groupCollapsed(`%c${prefix} ${message}`, color);
    
    if (context && Object.keys(context).length > 0) {
      console.log('Context:', context);
    }
    
    if (error) {
      console.error('Error:', error);
    }
    
    console.groupEnd();
  }

  private async sendToRemote(entry: LogEntry) {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) return;

    try {
      // Buffer entries for batch sending
      this.buffer.push(entry);

      // Send when buffer is full or for errors
      if (this.buffer.length >= this.config.bufferSize || entry.level === 'error') {
        const batch = [...this.buffer];
        this.buffer = [];

        await fetch(this.config.remoteEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: batch }),
          keepalive: true,
        });
      }
    } catch {
      // Silently fail remote logging
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      ...this.formatMessage(level, message, context),
      error,
    };

    this.writeToConsole(entry);
    this.sendToRemote(entry);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>) {
    const errorObj = error instanceof Error ? error : undefined;
    const errorContext = error && !(error instanceof Error) ? { errorData: error } : {};
    
    this.log('error', message, { ...context, ...errorContext }, errorObj);
  }

  /**
   * Log page navigation
   */
  pageView(path: string, context?: Record<string, unknown>) {
    this.info(`Page view: ${path}`, { type: 'navigation', path, ...context });
  }

  /**
   * Log user action
   */
  userAction(action: string, context?: Record<string, unknown>) {
    this.info(`User action: ${action}`, { type: 'user_action', action, ...context });
  }

  /**
   * Log API request
   */
  apiRequest(method: string, url: string, context?: Record<string, unknown>) {
    this.debug(`API ${method} ${url}`, { type: 'api_request', method, url, ...context });
  }

  /**
   * Log API response
   */
  apiResponse(method: string, url: string, status: number, duration: number) {
    const level = status >= 400 ? 'error' : 'debug';
    this.log(level, `API ${method} ${url} - ${status}`, {
      type: 'api_response',
      method,
      url,
      status,
      duration,
    });
  }

  /**
   * Log performance metric
   */
  performance(metric: string, value: number, unit: string = 'ms') {
    this.debug(`Performance: ${metric} = ${value}${unit}`, {
      type: 'performance',
      metric,
      value,
      unit,
    });
  }

  /**
   * Flush any buffered logs
   */
  async flush() {
    if (this.buffer.length > 0 && this.config.remoteEndpoint) {
      try {
        await fetch(this.config.remoteEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: this.buffer }),
          keepalive: true,
        });
        this.buffer = [];
      } catch {
        // Silently fail
      }
    }
  }
}

// Create singleton instance
export const logger = new FrontendLogger();

// Flush logs on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    logger.flush();
  });
}
