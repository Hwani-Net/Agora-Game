/**
 * agent-routes.ts — Agent API
 * =============================
 */

import { Router } from 'express';
import { authMiddleware, optionalAuth, type AuthRequest } from '../auth.js';
import { createAgent, getAgentById, getAgentsByOwner, listAgents, getLeaderboard, FACTIONS } from '../creation-lab.js';
import { logger } from '../logger.js';

const router = Router();

// POST /api/agents — Create agent
router.post('/', authMiddleware, (req: AuthRequest, res) => {
  try {
    const agent = createAgent(req.user!.id, req.user!.isPremium, req.body);
    res.status(201).json(agent);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Agent creation failed';
    logger.error({ error: msg }, 'Agent creation error');
    res.status(400).json({ error: msg });
  }
});

// GET /api/agents — List all agents
router.get('/', optionalAuth, (req: AuthRequest, res) => {
  try {
    const { faction, tier, sortBy, limit, offset } = req.query;
    const result = listAgents({
      faction: faction as string | undefined,
      tier: tier as string | undefined,
      sortBy: sortBy as 'elo_score' | 'wins' | 'created_at' | undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to list agents';
    res.status(500).json({ error: msg });
  }
});

// GET /api/agents/leaderboard
router.get('/leaderboard', (_req, res) => {
  try {
    const top = getLeaderboard(20);
    res.json(top);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get leaderboard';
    res.status(500).json({ error: msg });
  }
});

// GET /api/agents/factions
router.get('/factions', (_req, res) => {
  res.json(FACTIONS);
});

// GET /api/agents/my — Get user's agents
router.get('/my', authMiddleware, (req: AuthRequest, res) => {
  try {
    const agents = getAgentsByOwner(req.user!.id);
    res.json(agents);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get agents';
    res.status(500).json({ error: msg });
  }
});

// GET /api/agents/:id
router.get('/:id', optionalAuth, (req: AuthRequest, res) => {
  try {
    const agent = getAgentById(req.params.id as string);
    if (!agent) {
      res.status(404).json({ error: '에이전트를 찾을 수 없습니다.' });
      return;
    }
    res.json(agent);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get agent';
    res.status(500).json({ error: msg });
  }
});

export default router;
