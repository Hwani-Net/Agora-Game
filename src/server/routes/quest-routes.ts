/**
 * quest-routes.ts — Quest Board API
 * ====================================
 */

import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../auth.js';
import {
  generateDailyQuest, createBountyQuest, submitBountyAnswer,
  voteForSubmission, closeBountyQuest, listQuests, getQuestById, getQuestSubmissions,
} from '../quest-board.js';
import { logger } from '../logger.js';

const router = Router();

// POST /api/quests/daily — Generate daily quest
router.post('/daily', async (_req, res) => {
  try {
    const quest = await generateDailyQuest();
    res.status(201).json(quest);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate quest';
    logger.error({ error: msg }, 'Daily quest error');
    res.status(500).json({ error: msg });
  }
});

// POST /api/quests/bounty — Create bounty quest
router.post('/bounty', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { title, description, reward_gold, deadline_hours } = req.body;
    const quest = createBountyQuest(
      req.user!.id, title, description,
      Number(reward_gold), Number(deadline_hours) || 24,
    );
    res.status(201).json(quest);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create bounty';
    res.status(400).json({ error: msg });
  }
});

// POST /api/quests/:id/submit — Submit answer to bounty
router.post('/:id/submit', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { agent_id, answer } = req.body;
    const submission = submitBountyAnswer(req.params.id as string, agent_id, answer);
    res.status(201).json(submission);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to submit answer';
    res.status(400).json({ error: msg });
  }
});

// POST /api/quests/submissions/:id/vote — Vote for a submission
router.post('/submissions/:id/vote', authMiddleware, (req: AuthRequest, res) => {
  try {
    voteForSubmission(req.params.id as string, req.user!.id);
    res.json({ message: '투표 완료! 10골드를 보상으로 받았습니다.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Vote failed';
    res.status(400).json({ error: msg });
  }
});

// POST /api/quests/:id/close — Close bounty quest
router.post('/:id/close', authMiddleware, (req: AuthRequest, res) => {
  try {
    const winner = closeBountyQuest(req.params.id as string);
    res.json({ winner, message: winner ? '퀘스트가 마감되었습니다!' : '제출된 답변이 없어 환불 처리되었습니다.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Close failed';
    res.status(400).json({ error: msg });
  }
});

// GET /api/quests — List quests
router.get('/', (_req, res) => {
  try {
    const type = _req.query.type as 'daily' | 'bounty' | undefined;
    const status = _req.query.status as string | undefined;
    const quests = listQuests(type, status);
    res.json(quests);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to list quests';
    res.status(500).json({ error: msg });
  }
});

// GET /api/quests/:id
router.get('/:id', (_req, res) => {
  try {
    const quest = getQuestById(_req.params.id);
    if (!quest) {
      res.status(404).json({ error: '퀘스트를 찾을 수 없습니다.' });
      return;
    }
    res.json(quest);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get quest';
    res.status(500).json({ error: msg });
  }
});

// GET /api/quests/:id/submissions
router.get('/:id/submissions', (_req, res) => {
  try {
    const submissions = getQuestSubmissions(_req.params.id);
    res.json(submissions);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get submissions';
    res.status(500).json({ error: msg });
  }
});

export default router;
