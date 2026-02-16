/**
 * user-routes.ts — User API
 * ===========================
 */

import { Router } from 'express';
import { authMiddleware, type AuthRequest, demoLogin, loginOrRegister } from '../auth.js';
import { getGoldBalance, getGoldHistory } from '../gold-economy.js';
import { getAgentsByOwner } from '../creation-lab.js';
import { getUserPortfolio } from '../stock-exchange.js';
import { getDb } from '../db.js';

const router = Router();

// POST /api/users/demo-login — Demo login for development
router.post('/demo-login', (req, res) => {
  try {
    const { name } = req.body;
    const result = demoLogin(name || 'Demo User');
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Login failed';
    res.status(400).json({ error: msg });
  }
});

// POST /api/users/login — Google OAuth login
router.post('/login', (req, res) => {
  try {
    const { email, name, avatar } = req.body;
    if (!email || !name) {
      res.status(400).json({ error: '이메일과 이름이 필요합니다.' });
      return;
    }
    const result = loginOrRegister(email, name, avatar);
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Login failed';
    res.status(400).json({ error: msg });
  }
});

// GET /api/users/me — Get current user profile
router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const db = getDb();
    const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as Record<string, unknown> | undefined;

    if (!dbUser) {
      res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      return;
    }

    const gold = getGoldBalance(user.id);
    const agents = getAgentsByOwner(user.id);
    const portfolio = getUserPortfolio(user.id);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: dbUser.avatar,
      isPremium: user.isPremium,
      gold_balance: gold,
      agents_count: agents.length,
      portfolio_value: portfolio.reduce((sum, p) => sum + p.shares_owned * p.current_price, 0),
      created_at: dbUser.created_at,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get profile';
    res.status(500).json({ error: msg });
  }
});

// GET /api/users/gold/history — Gold transaction history
router.get('/gold/history', authMiddleware, (req: AuthRequest, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const history = getGoldHistory(req.user!.id, limit);
    res.json(history);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get gold history';
    res.status(500).json({ error: msg });
  }
});

export default router;
