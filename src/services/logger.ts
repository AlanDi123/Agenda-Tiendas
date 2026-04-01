/**
 * logger.ts — Logger seguro para Capacitor + React
 * 
 * FIX aplicado: el logger anterior interceptaba console.error y luego
 * lo llamaba internamente → recursión infinita → stack overflow.
 * 
 * Solución: guardar referencias NATIVAS antes de cualquier override,
 * y NUNCA patchear console.* — usar addEventListener directamente.
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  sessionId: string;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const IS_DEV    = import.meta.env.DEV
const LOG_KEY = 'dommuss_app_logs';
const MAX_LOGS = 300;
const SESSION_KEY = 'dommuss_session_id';

// ─────────────────────────────────────────────────────────────────
// PASO CRÍTICO: guardar referencias NATIVAS *antes* de cualquier
// override. Esto rompe el bucle de raíz.
// ─────────────────────────────────────────────────────────────────
const _native = {
  log:   console.log.bind(console),
  info:  console.info.bind(console),
  warn:  console.warn.bind(console),
  error: console.error.bind(console),
} as const

const PREFIX: Record<LogLevel, string> = {
  debug: '🔍 [DEBUG]',
  info:  'ℹ️  [INFO] ',
  warn:  '⚠️  [WARN] ',
  error: '❌ [ERROR]',
}

// Generate or retrieve session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// Get user ID / email from storage (auth guarda `currentUser` como JSON)
function getUserId(): string | undefined {
  try {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      const u = JSON.parse(raw) as { id?: string; email?: string };
      if (u?.id) return u.id;
      if (u?.email) return u.email;
    }
    return localStorage.getItem('currentUserEmail') || undefined;
  } catch {
    return undefined;
  }
}

function getRuntimeContext(): Record<string, unknown> {
  const cap = typeof window !== 'undefined' ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor : undefined;
  return {
    isCapacitor: !!cap?.isNativePlatform?.(),
    language: typeof navigator !== 'undefined' ? navigator.language : undefined,
    timeZone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
  };
}

// Create log entry
function createLogEntry(
  level: LogEntry['level'],
  message: string,
  error?: unknown,
  context?: string,
  metadata?: Record<string, unknown>
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
      ...getRuntimeContext(),
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
    _native.error('Error saving log, storage might be full:', e);
    try {
      const logs = AppLogger.getLogs();
      logs.splice(0, Math.floor(logs.length / 2)); // Remove oldest half
      logs.unshift(log);
      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch (e2) {
      _native.error('Failed to save log after cleanup:', e2);
    }
  }
}

class AppLoggerClass {
  private readonly tag: string

  constructor(context: string) {
    this.tag = context
  }

  private _emit(level: LogLevel, args: unknown[]): void {
    if (level === 'debug' && !IS_DEV) return

    const label = `${PREFIX[level]} ${this.tag}:`

    // ✅ SIEMPRE usar _native — NUNCA console.xxx directo
    switch (level) {
      case 'debug': _native.log(label, ...args);   break
      case 'info':  _native.info(label, ...args);  break
      case 'warn':  _native.warn(label, ...args);  break
      case 'error': _native.error(label, ...args); break
    }
  }

  debug(...args: unknown[]): void { this._emit('debug', args) }
  info (...args: unknown[]): void { this._emit('info',  args) }
  warn (...args: unknown[]): void { this._emit('warn',  args) }
  error(...args: unknown[]): void { this._emit('error', args) }
}

export const AppLogger = {
  // Core logging method — usa _native directamente
  log: (
    level: LogEntry['level'],
    message: string,
    error?: unknown,
    context?: string,
    metadata?: Record<string, unknown>
  ): void => {
    const logEntry = createLogEntry(level, message, error, context, metadata);
    saveLog(logEntry);

    // Also log to console with context — usa _native, NO console[level]
    const nativeMethod = level === 'error' ? _native.error : 
                         level === 'warn' ? _native.warn : 
                         level === 'info' ? _native.info : _native.log;
    nativeMethod(
      `[${level.toUpperCase()}] ${context || 'App'}: ${message}`,
      error !== undefined && error !== null
        ? error instanceof Error
          ? error.message
          : String(error)
        : ''
    );
  },

  // Convenience methods
  error: (message: string, error?: unknown, context?: string): void =>
    AppLogger.log('error', message, error, context),

  warn: (message: string, error?: unknown, context?: string): void =>
    AppLogger.log('warn', message, error, context),

  info: (message: string, metadata?: Record<string, unknown>, context?: string): void =>
    AppLogger.log('info', message, undefined, context, metadata),

  debug: (message: string, metadata?: Record<string, unknown>, context?: string): void =>
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
      _native.info('Logs cleared');
    } catch (e) {
      _native.error('Error clearing logs:', e);
    }
  },

  // Export logs as JSON string
  exportLogs: (): string => {
    try {
      const logs = AppLogger.getLogs();
      return JSON.stringify(logs, null, 2);
    } catch (e) {
      _native.error('Error exporting logs:', e);
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
      _native.error('Error exporting logs to file:', e);
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

  /** Registro explícito para auditoría (acciones sensibles, pagos, admin). */
  audit: (action: string, metadata?: Record<string, unknown>): void => {
    AppLogger.log('info', `AUDIT: ${action}`, undefined, 'Audit', {
      ...getRuntimeContext(),
      ...metadata,
    });
  },

  // Initialize global error handlers — usa AppLoggerClass para logs internos
  initGlobalHandlers: (): void => {
    const globalLogger = new AppLoggerClass('GlobalError');

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      globalLogger.error(
        'Unhandled Promise Rejection',
        event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      );
    });

    // Global error handler
    window.addEventListener('error', (event: ErrorEvent) => {
      globalLogger.error('Global Error', event.error, {
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
        globalLogger.error('Network Error', error, {
          url: args[0] instanceof Request ? args[0].url : String(args[0]),
          method: args[1]?.method || 'GET',
        });
        throw error;
      });
    };

    _native.info('Global error handlers initialized');
  },

  // Log app lifecycle events
  logLifecycle: (event: 'app_start' | 'app_resume' | 'app_pause' | 'app_exit', metadata?: Record<string, unknown>): void => {
    AppLogger.info(`App ${event}`, metadata, 'Lifecycle');
  },

  // Log user actions
  logUserAction: (action: string, metadata?: Record<string, unknown>): void => {
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
