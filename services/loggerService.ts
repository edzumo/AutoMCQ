import { LogEntry, LogLevel } from '../types';
import Papa from 'papaparse';

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  private createEntry(level: LogLevel, source: string, message: string, meta?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      meta: meta ? JSON.stringify(meta) : undefined
    };
  }

  log(level: LogLevel, source: string, message: string, meta?: any) {
    const entry = this.createEntry(level, source, message, meta);
    this.logs.push(entry);
    console.log(`[${level}] [${source}] ${message}`, meta || '');
    this.notifyListeners();
  }

  info(source: string, message: string, meta?: any) {
    this.log('INFO', source, message, meta);
  }

  warn(source: string, message: string, meta?: any) {
    this.log('WARN', source, message, meta);
  }

  error(source: string, message: string, meta?: any) {
    this.log('ERROR', source, message, meta);
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
    this.notifyListeners();
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.logs));
  }

  downloadLogs() {
    const csv = Papa.unparse(this.logs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `automcq_logs_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const logger = new LoggerService();
