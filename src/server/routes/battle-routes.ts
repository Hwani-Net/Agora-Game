/**
 * battle-routes.ts — Battle Arena API
 * ======================================
 */

import { Router, type Response } from 'express';
import { authMiddleware, optionalAuth, type AuthRequest } from '../auth.js';
import { runDebate, findMatch, getDebateById, getRecentDebates, getActiveDebates, subscribeToDebate, getRandomTopic } from '../arena.js';
import { checkDebateLimit } from '../rate-limiter.js';
import { logger } from '../logger.js';

const router = Router();

// POST /api/battles — Start a new battle
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = checkDebateLimit(req.user!.id, req.user!.isPremium);
    if (!limit.allowed) {
      res.status(429).json({ error: limit.message, remaining: limit.remaining });
      return;
    }

    const { agent1_id, agent2_id, topic } = req.body;
    if (!agent1_id || !agent2_id) {
      res.status(400).json({ error: '토론할 에이전트 2명의 ID가 필요합니다.' });
      return;
    }

    const debate = await runDebate(agent1_id, agent2_id, topic);
    res.status(201).json(debate);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Battle failed';
    logger.error({ error: msg }, 'Battle error');
    res.status(400).json({ error: msg });
  }
});

// POST /api/battles/auto — Trigger auto-match battle
router.post('/auto', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = checkDebateLimit(req.user!.id, req.user!.isPremium);
    if (!limit.allowed) {
      res.status(429).json({ error: limit.message });
      return;
    }

    const match = findMatch();
    if (!match) {
      res.status(404).json({ error: '매칭 가능한 에이전트가 없습니다. 더 많은 에이전트를 만들어주세요!' });
      return;
    }

    const debate = await runDebate(match.agent1.id, match.agent2.id);
    res.status(201).json(debate);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Auto battle failed';
    res.status(400).json({ error: msg });
  }
});

// GET /api/battles/recent
router.get('/recent', (_req, res) => {
  try {
    const limit = Number(_req.query.limit) || 10;
    const debates = getRecentDebates(limit);
    res.json(debates);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get recent battles';
    res.status(500).json({ error: msg });
  }
});

// GET /api/battles/active
router.get('/active', (_req, res) => {
  try {
    const debates = getActiveDebates();
    res.json(debates);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get active battles';
    res.status(500).json({ error: msg });
  }
});

// GET /api/battles/topics — Get random topics
router.get('/topics', (_req, res) => {
  const topics = Array.from({ length: 5 }, () => getRandomTopic());
  res.json(topics);
});

// GET /api/battles/:id
router.get('/:id', optionalAuth, (req: AuthRequest, res) => {
  try {
    const debate = getDebateById(req.params.id as string);
    if (!debate) {
      res.status(404).json({ error: '토론을 찾을 수 없습니다.' });
      return;
    }
    res.json(debate);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get battle';
    res.status(500).json({ error: msg });
  }
});

// GET /sse/battles/:id — SSE stream for live spectating
router.get('/:id/stream', (req, res: Response) => {
  const debateId = req.params.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const unsubscribe = subscribeToDebate(debateId, (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});

export default router;
