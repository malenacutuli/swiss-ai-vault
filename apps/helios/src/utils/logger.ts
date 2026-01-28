type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };
    const output = JSON.stringify(entry);
    level === 'error' ? console.error(output) : console.log(output);
  }

  debug(msg: string, ctx?: Record<string, unknown>) { this.log('debug', msg, ctx); }
  info(msg: string, ctx?: Record<string, unknown>) { this.log('info', msg, ctx); }
  warn(msg: string, ctx?: Record<string, unknown>) { this.log('warn', msg, ctx); }
  error(msg: string, ctx?: Record<string, unknown>) { this.log('error', msg, ctx); }
}

export const logger = new Logger();
