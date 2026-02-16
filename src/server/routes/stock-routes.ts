/**
 * stock-routes.ts — Stock Market API
 * =====================================
 */

import { Router } from 'express';
import { authMiddleware, optionalAuth, type AuthRequest } from '../auth.js';
import {
  executeIPO, buyShares, sellShares, getAllStocks, getStockByAgentId,
  getUserPortfolio, getUserTransactions,
} from '../stock-exchange.js';
import { logger } from '../logger.js';

const router = Router();

// POST /api/stocks/ipo — IPO an agent
router.post('/ipo', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { agent_id } = req.body;
    if (!agent_id) {
      res.status(400).json({ error: '상장할 에이전트 ID가 필요합니다.' });
      return;
    }
    const stock = executeIPO(agent_id);
    res.status(201).json(stock);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'IPO failed';
    logger.error({ error: msg }, 'IPO error');
    res.status(400).json({ error: msg });
  }
});

// POST /api/stocks/buy — Buy shares
router.post('/buy', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { stock_id, shares } = req.body;
    if (!stock_id || !shares) {
      res.status(400).json({ error: '주식 ID와 수량이 필요합니다.' });
      return;
    }
    const txn = buyShares(req.user!.id, stock_id, Number(shares), req.user!.isPremium);
    res.status(201).json(txn);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Buy failed';
    res.status(400).json({ error: msg });
  }
});

// POST /api/stocks/sell — Sell shares
router.post('/sell', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { stock_id, shares } = req.body;
    if (!stock_id || !shares) {
      res.status(400).json({ error: '주식 ID와 수량이 필요합니다.' });
      return;
    }
    const txn = sellShares(req.user!.id, stock_id, Number(shares), req.user!.isPremium);
    res.status(201).json(txn);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Sell failed';
    res.status(400).json({ error: msg });
  }
});

// GET /api/stocks — All listed stocks
router.get('/', (_req, res) => {
  try {
    const stocks = getAllStocks();
    res.json(stocks);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get stocks';
    res.status(500).json({ error: msg });
  }
});

// GET /api/stocks/portfolio — User portfolio
router.get('/portfolio', authMiddleware, (req: AuthRequest, res) => {
  try {
    const portfolio = getUserPortfolio(req.user!.id);
    res.json(portfolio);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get portfolio';
    res.status(500).json({ error: msg });
  }
});

// GET /api/stocks/transactions — User transaction history
router.get('/transactions', authMiddleware, (req: AuthRequest, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const txns = getUserTransactions(req.user!.id, limit);
    res.json(txns);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get transactions';
    res.status(500).json({ error: msg });
  }
});

// GET /api/stocks/agent/:agentId — Stock for a specific agent
router.get('/agent/:agentId', optionalAuth, (req: AuthRequest, res) => {
  try {
    const stock = getStockByAgentId(req.params.agentId as string);
    if (!stock) {
      res.status(404).json({ error: '이 에이전트는 아직 상장되지 않았습니다.' });
      return;
    }
    res.json(stock);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to get stock';
    res.status(500).json({ error: msg });
  }
});

export default router;
