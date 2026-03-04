// Enhanced Logging Service
// Captures unhandled exceptions, background failures, and enables export

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: string;
  stack?: string;
  metadata?: Record<string, any>;
  userId?: string;
  sessionId: string;
}

const LOG_KEY = 'dommuss_app_logs';
const MAX_LOGS = 100;
const SESSION_KEY = 'dommuss_session_id';

// Generate or retrieve session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// Get user ID from storage
function getUserId(): string | undefined {
  try {
    const session = localStorage.getItem('currentUserEmail');
    return session || undefined;
  } catch {
    return undefined;
  }
}

// Create log entry
function createLogEntry(
  level: LogEntry['level'],
  message: string,
  error?: any,
  context?: string,
  metadata?: Record<string, any>
): LogEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    stack: error instanceof Error ? error.stack : undefined,
    metadata: {
      ...metadata,
      userAgent: navigator.userAgent,
      url: window.location.href,
      online: navigator.onLine,
      platform: navigator.platform,
    },
    sessionId: getSessionId(),
    userId: getUserId(),
  };
}

// Save log to storage
function saveLog(log: LogEntry): void {
  try {
    const logs = AppLogger.getLogs();
    logs.unshift(log);
    
    // Trim to max logs
    while (logs.length > MAX_LOGS) {
      logs.pop();
    }

    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    // Storage might be full, try to clear old logs
    console.error('Error saving log, storage might be full:', e);
    try {
      const logs = AppLogger.getLogs();
      logs.splice(0, Math.floor(logs.length / 2)); // Remove oldest half
      logs.unshift(log);
      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch (e2) {
      console.error('Failed to save log after cleanup:', e2);
    }
  }
}

export const AppLogger = {
  // Core logging method
  log: (
    level: LogEntry['level'],
    message: string,
    error?: any,
    context?: string,
    metadata?: Record<string, any>
  ): void => {
    const logEntry = createLogEntry(level, message, error, context, metadata);
    saveLog(logEntry);
    
    // Also log to console with context
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[${level.toUpperCase()}] ${context || 'App'}: ${message}`, error || '');
  },

  // Convenience methods
  error: (message: string, error?: any, context?: string): void => 
    AppLogger.log('error', message, error, context),
  
  warn: (message: string, error?: any, context?: string): void => 
    AppLogger.log('warn', message, error, context),
  
  info: (message: string, metadata?: Record<string, any>, context?: string): void => 
    AppLogger.log('info', message, undefined, context, metadata),
  
  debug: (message: string, metadata?: Record<string, any>, context?: string): void => 
    AppLogger.log('debug', message, undefined, context, metadata),

  // Get logs from storage
  getLogs: (): LogEntry[] => {
    try {
      const logsStr = localStorage.getItem(LOG_KEY);
      return logsStr ? JSON.parse(logsStr) : [];
    } catch {
      return [];
    }
  },

  // Get logs filtered by level
  getLogsByLevel: (level: LogEntry['level']): LogEntry[] => {
    return AppLogger.getLogs().filter(log => log.level === level);
  },

  // Get recent logs (last N entries)
  getRecentLogs: (count: number = 20): LogEntry[] => {
    return AppLogger.getLogs().slice(0, count);
  },

  // Clear all logs
  clearLogs: (): void => {
    try {
      localStorage.removeItem(LOG_KEY);
      console.info('Logs cleared');
    } catch (e) {
      console.error('Error clearing logs:', e);
    }
  },

  // Export logs as JSON string
  exportLogs: (): string => {
    try {
      const logs = AppLogger.getLogs();
      return JSON.stringify(logs, null, 2);
    } catch (e) {
      console.error('Error exporting logs:', e);
      return '[]';
    }
  },

  // Export logs as downloadable file
  exportLogsToFile: (filename?: string): void => {
    try {
      const logs = AppLogger.getLogs();
      const logsText = JSON.stringify(logs, null, 2);
      const blob = new Blob([logsText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `dommuss-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exporting logs to file:', e);
    }
  },

  // Get log statistics
  getLogStats: (): {
    total: number;
    byLevel: Record<LogEntry['level'], number>;
    oldestLog: string | null;
    newestLog: string | null;
  } => {
    const logs = AppLogger.getLogs();
    const byLevel: Record<LogEntry['level'], number> = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
    };

    logs.forEach(log => {
      byLevel[log.level]++;
    });

    return {
      total: logs.length,
      byLevel,
      oldestLog: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
      newestLog: logs.length > 0 ? logs[0].timestamp : null,
    };
  },

  // Search logs by message
  searchLogs: (query: string): LogEntry[] => {
    const lowerQuery = query.toLowerCase();
    return AppLogger.getLogs().filter(
      log => 
        log.message.toLowerCase().includes(lowerQuery) ||
        log.context?.toLowerCase().includes(lowerQuery) ||
        log.stack?.toLowerCase().includes(lowerQuery)
    );
  },

  // Initialize global error handlers
  initGlobalHandlers: (): void => {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      AppLogger.log('error', 'Unhandled Promise Rejection', error, 'GlobalHandler');
    });

    // Global error handler
    window.addEventListener('error', (event: ErrorEvent) => {
      AppLogger.log('error', 'Global Error', event.error, 'GlobalHandler', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message,
      });
    });

    // Network errors
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      return originalFetch.apply(this, args).catch((error) => {
        AppLogger.log('error', 'Network Error', error, 'Network', {
          url: args[0] instanceof Request ? args[0].url : String(args[0]),
          method: args[1]?.method || 'GET',
        });
        throw error;
      });
    };

    console.info('Global error handlers initialized');
  },

  // Log app lifecycle events
  logLifecycle: (event: 'app_start' | 'app_resume' | 'app_pause' | 'app_exit', metadata?: Record<string, any>): void => {
    AppLogger.info(`App ${event}`, metadata, 'Lifecycle');
  },

  // Log user actions
  logUserAction: (action: string, metadata?: Record<string, any>): void => {
    AppLogger.info(`User Action: ${action}`, metadata, 'UserAction');
  },

  // Log API calls
  logApiCall: (endpoint: string, method: string, status: number, duration?: number): void => {
    AppLogger.debug(`API ${method} ${endpoint}`, { status, duration }, 'API');
  },

  // Log performance metrics
  logPerformance: (metric: string, value: number, unit: string = 'ms'): void => {
    AppLogger.debug(`Performance: ${metric}`, { value, unit }, 'Performance');
  },
};

// Auto-initialize on module load
if (typeof window !== 'undefined') {
  AppLogger.initGlobalHandlers();
  AppLogger.logLifecycle('app_start');
}
