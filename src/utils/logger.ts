/**
 * Winston logger with emoji support
 */
import { createLogger as createWinstonLogger, format, transports, Logger } from 'winston';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

const { combine, timestamp, printf, colorize, errors } = format;

// Ensure log directory exists
const logDir = resolve(process.cwd(), 'data', 'logs');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

const consoleFormat = printf(({ level, message, timestamp, label, ...metadata }) => {
  const labelStr = label ? `[${label}] ` : '';
  const metaStr = Object.keys(metadata).length ? `\n${JSON.stringify(metadata, null, 2)}` : '';
  return `${timestamp} ${level}: ${labelStr}${message}${metaStr}`;
});

const fileFormat = printf(({ level, message, timestamp, label, ...metadata }) => {
  const labelStr = label ? `[${label}] ` : '';
  const metaStr = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : '';
  // Strip emojis for log file
  const cleanMessage = (message as string).replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  return `${timestamp} [${level.toUpperCase()}] ${labelStr}${cleanMessage}${metaStr}`;
});

export function createLogger(label?: string): Logger {
  const today = new Date().toISOString().split('T')[0];

  return createWinstonLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { label },
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true })
    ),
    transports: [
      // Console output with colors and emojis
      new transports.Console({
        format: combine(
          colorize(),
          timestamp({ format: 'HH:mm:ss' }),
          consoleFormat
        ),
      }),
      // File output without colors/emojis
      new transports.File({
        filename: resolve(logDir, `${today}.log`),
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      // Error log file
      new transports.File({
        filename: resolve(logDir, 'error.log'),
        level: 'error',
        format: fileFormat,
      }),
    ],
    exitOnError: false,
  });
}

// Default logger instance
export const logger = createLogger();
