/**
 * index.ts — Express Server Entry Point
 * ========================================
 * AI Agora Backend Server
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initializeSchema } from './db.js';
import { seedDemoData } from './seed-data.js';
import { logger } from './logger.js';


// Route imports
import agentRoutes from './routes/agent-routes.js';
import battleRoutes from './routes/battle-routes.js';
import stockRoutes from './routes/stock-routes.js';
import questRoutes from './routes/quest-routes.js';
import eventRoutes from './routes/event-routes.js';
import userRoutes from './routes/user-routes.js';

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const app = express();

// ─── Middleware ───
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ─── Request Logging ───
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url }, 'Request');
  next();
});

// ─── Routes ───
app.use('/api/agents', agentRoutes);
app.use('/api/battles', battleRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// ─── Health Check ───
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'AI Agora',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Error Handler ───
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  },
);

// ─── Start Server ───
function start(): void {
  // Initialize database
  initializeSchema();
  seedDemoData();

  app.listen(PORT, () => {
    logger.info({ port: PORT }, '🏛️ AI Agora server started');
    logger.info(`   API:   http://localhost:${PORT}/api/health`);
    logger.info(`   토론이 시작됩니다! 아고라 광장에 오신 것을 환영합니다.`);
  });
}

start();
