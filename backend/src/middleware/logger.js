// src/middleware/logger.js
const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, errors, json, colorize, printf } = format;

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `${ts} [${level}] ${message}${metaStr}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true }),
    process.env.NODE_ENV === 'production' ? json() : combine(colorize(), devFormat)
  ),
  transports: [
    new transports.Console(),
    ...(process.env.NODE_ENV === 'production' ? [
      new transports.File({
        filename: path.join(process.cwd(), 'logs', 'sentinel.log'),
        maxsize:  50 * 1024 * 1024, // 50MB
        maxFiles: 5,
        tailable: true,
      }),
      new transports.File({
        filename: path.join(process.cwd(), 'logs', 'error.log'),
        level:    'error',
        maxsize:  20 * 1024 * 1024,
        maxFiles: 3,
      }),
    ] : []),
  ],
  exitOnError: false,
});

// Express request logger middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';
    logger[level]('HTTP', {
      method:  req.method,
      path:    req.path,
      status:  res.statusCode,
      ms,
      ip:      req.ip,
      role:    req.user?.role,
    });
  });
  next();
};

module.exports = { logger, requestLogger };
