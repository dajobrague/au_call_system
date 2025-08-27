// Structured logging for FSM state transitions and call events

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  callSid?: string;
  from?: string;
  to?: string;
  [key: string]: any;
}

/**
 * Sanitize sensitive data from logs
 * Removes PII like full phone numbers, speech content, etc.
 */
function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = { ...data };
  
  // Sanitize phone numbers - keep only last 4 digits
  if (sanitized.from && typeof sanitized.from === 'string') {
    sanitized.from = sanitized.from.replace(/^\+?1?(\d{6})(\d{4})$/, '***-***-$2');
  }
  if (sanitized.to && typeof sanitized.to === 'string') {
    sanitized.to = sanitized.to.replace(/^\+?1?(\d{6})(\d{4})$/, '***-***-$2');
  }
  
  // Remove raw speech content - keep only metadata
  if (sanitized.speechResult) {
    delete sanitized.speechResult;
  }
  if (sanitized.digits && sanitized.digits.length > 2) {
    sanitized.digits = `[${sanitized.digits.length} digits]`;
  }
  
  // Keep only safe input metadata
  if (sanitized.input && sanitized.input.length > 2) {
    sanitized.input = `[${sanitized.input.length} chars]`;
  }
  
  return sanitized;
}

// Extended context for FSM state transitions
interface FSMLogData extends LogContext {
  ts?: string;
  sid?: string;
  phase?: string;
  hasInput?: boolean;
  inputSource?: string;
  attempts?: { clientId: number; jobNumber: number };
  action?: string;
  latencyMs?: number;
  error?: string;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  // Standard logging methods
  info(message: string, context?: LogContext) {
    console.info(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context?: LogContext) {
    console.error(this.formatMessage('error', message, context));
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  // Specialized method for FSM state transitions (structured JSON)
  stateTransition(data: FSMLogData) {
    const sanitizedData = sanitizeLogData(data);
    const logEntry = {
      level: 'INFO',
      message: 'FSM state transition',
      ts: new Date().toISOString(),
      ...sanitizedData,
    };
    console.log(JSON.stringify(logEntry));
  }

  // Request logging for webhook calls
  webhookRequest(data: FSMLogData) {
    const sanitizedData = sanitizeLogData(data);
    const logEntry = {
      level: 'INFO',
      message: 'Twilio webhook request',
      ts: new Date().toISOString(),
      ...sanitizedData,
    };
    console.log(JSON.stringify(logEntry));
  }
}

export const logger = new Logger();
export type { LogContext, FSMLogData };