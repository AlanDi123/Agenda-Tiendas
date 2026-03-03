export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
}

const LOG_KEY = 'dommuss_app_logs';
const MAX_LOGS = 50;

export const AppLogger = {
  log: (level: 'error' | 'warn' | 'info', message: string, error?: any) => {
    try {
      const logs = AppLogger.getLogs();
      const newLog: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level,
        message,
        stack: error instanceof Error ? error.stack : JSON.stringify(error)
      };
      
      logs.unshift(newLog);
      if (logs.length > MAX_LOGS) logs.pop();
      
      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
      console[level](message, error); // Mantener log en consola original
    } catch (e) {
      console.error('Error saving log', e);
    }
  },
  
  error: (message: string, error?: any) => AppLogger.log('error', message, error),
  warn: (message: string, error?: any) => AppLogger.log('warn', message, error),
  info: (message: string, error?: any) => AppLogger.log('info', message, error),
  
  getLogs: (): LogEntry[] => {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    } catch { 
      return []; 
    }
  },
  
  clearLogs: () => {
    try {
      localStorage.removeItem(LOG_KEY);
    } catch (e) {
      console.error('Error clearing logs', e);
    }
  },
  
  exportLogs: (): string => {
    try {
      const logs = AppLogger.getLogs();
      return JSON.stringify(logs, null, 2);
    } catch (e) {
      console.error('Error exporting logs', e);
      return '[]';
    }
  }
};
