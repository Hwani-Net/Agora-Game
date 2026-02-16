/**
 * logger.ts — Structured Logger (Pino)
 * =====================================
 * All logging must use this module. console.log() is banned.
 */

import pino from 'pino';

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});
