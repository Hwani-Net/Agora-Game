/**
 * event-routes.ts — Events & Governance API
 * ============================================
 */

import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../auth.js';
import {
  createEvent, getActiveEvents, createPoll, voteOnPoll,
  getActivePolls, generateDailyProphet,
} from '../living-politics.js';
import { logger } from '../logger.js';

const router = Router();

// GET /api/events — Active events
router.get('/', (_req, res) => {
  try {
    const events = getActiveEvents();
    res.json(events);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get events';
    res.status(500).json({ error: msg });
  }
});

// POST /api/events — Create event (admin)
router.post('/', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { title, description, type, intensity, expires_in_hours } = req.body;
    const event = createEvent(title, description, type || 'community', intensity, Number(expires_in_hours) || 24);
    res.status(201).json(event);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create event';
    logger.error({ error: msg }, 'Event creation error');
    res.status(400).json({ error: msg });
  }
});

// GET /api/events/news — Daily Prophet
router.get('/news', async (_req, res) => {
  try {
    const article = await generateDailyProphet();
    res.json(article);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate news';
    res.status(500).json({ error: msg });
  }
});

// GET /api/events/polls — Active polls
router.get('/polls', (_req, res) => {
  try {
    const polls = getActivePolls();
    res.json(polls);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get polls';
    res.status(500).json({ error: msg });
  }
});

// POST /api/events/polls — Create poll
router.post('/polls', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { question, options, deadline_hours } = req.body;
    const poll = createPoll(question, options, Number(deadline_hours) || 24);
    res.status(201).json(poll);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create poll';
    res.status(400).json({ error: msg });
  }
});

// POST /api/events/polls/:id/vote — Vote on poll
router.post('/polls/:id/vote', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { option_index } = req.body;
    voteOnPoll(req.params.id as string, req.user!.id, Number(option_index));
    res.json({ message: '투표 완료! 10골드를 보상으로 받았습니다.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Vote failed';
    res.status(400).json({ error: msg });
  }
});

export default router;
