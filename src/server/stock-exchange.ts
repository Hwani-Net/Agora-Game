/**
 * stock-exchange.ts — AI Agent Stock Exchange (Module 4.3)
 * =========================================================
 * IPO, buy/sell shares, price fluctuation engine, dividends.
 * The killer feature that drives retention and monetization.
 */

import { getDb, generateId } from './db.js';
import { getAgentById } from './creation-lab.js';
import { canIPO, type Tier } from './elo.js';
import { spendGold, earnGold, getGoldBalance } from './gold-economy.js';
import { checkTradeLimit, incrementTradeCount } from './rate-limiter.js';
import { logger } from './logger.js';

// ─── Types ───

export interface AgentStock {
  id: string;
  agent_id: string;
  current_price: number;
  total_shares: number;
  available_shares: number;
  market_cap: number;
  price_change_24h: number;
  dividend_per_win: number;
  ipo_date: string;
}

export interface StockOwnership {
  id: string;
  user_id: string;
  stock_id: string;
  shares_owned: number;
  avg_buy_price: number;
}

export interface StockTransaction {
  id: string;
  user_id: string;
  stock_id: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  total_amount: number;
  timestamp: string;
}

// ─── IPO ───

export function executeIPO(agentId: string): AgentStock {
  const agent = getAgentById(agentId);
  if (!agent) throw new Error('에이전트를 찾을 수 없습니다.');

  if (!canIPO(agent.tier as Tier)) {
    throw new Error(`IPO는 Diamond 이상 티어에서만 가능합니다. 현재 티어: ${agent.tier}`);
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM agent_stocks WHERE agent_id = ?').get(agentId);
  if (existing) {
    throw new Error('이 에이전트는 이미 상장되어 있습니다.');
  }

  const id = generateId();
  const initialPrice = 1000;
  const totalShares = 1000;

  db.prepare(
    `INSERT INTO agent_stocks (id, agent_id, current_price, total_shares, available_shares, market_cap)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, agentId, initialPrice, totalShares, totalShares, initialPrice * totalShares);

  logger.info({ agentId, stockId: id, agentName: agent.name }, 'IPO executed');
  return getStockById(id)!;
}

// ─── Buy Shares ───

export function buyShares(
  userId: string,
  stockId: string,
  shares: number,
  isPremium: boolean,
): StockTransaction {
  if (shares <= 0) throw new Error('매수 수량은 1 이상이어야 합니다.');

  const limitCheck = checkTradeLimit(userId, isPremium);
  if (!limitCheck.allowed) throw new Error(limitCheck.message);

  const stock = getStockById(stockId);
  if (!stock) throw new Error('주식 정보를 찾을 수 없습니다.');

  if (shares > stock.available_shares) {
    throw new Error(`매수 가능한 주식이 부족합니다. 잔여: ${stock.available_shares}주`);
  }

  const totalCost = Math.round(stock.current_price * shares);
  const balance = getGoldBalance(userId);
  if (balance < totalCost) {
    throw new Error(`골드가 부족합니다. 필요: ${totalCost}골드, 보유: ${balance}골드`);
  }

  const db = getDb();
  const txn = db.transaction(() => {
    // Deduct gold
    spendGold(userId, totalCost, 'stock_buy', `주식 매수: ${shares}주 × ${stock.current_price}골드`);

    // Update available shares
    db.prepare('UPDATE agent_stocks SET available_shares = available_shares - ? WHERE id = ?').run(shares, stockId);

    // Update or create ownership
    const existing = db
      .prepare('SELECT * FROM stock_ownership WHERE user_id = ? AND stock_id = ?')
      .get(userId, stockId) as StockOwnership | undefined;

    if (existing) {
      const newTotal = existing.shares_owned + shares;
      const newAvg =
        (existing.avg_buy_price * existing.shares_owned + stock.current_price * shares) / newTotal;
      db.prepare('UPDATE stock_ownership SET shares_owned = ?, avg_buy_price = ? WHERE id = ?').run(
        newTotal,
        newAvg,
        existing.id,
      );
    } else {
      db.prepare(
        'INSERT INTO stock_ownership (id, user_id, stock_id, shares_owned, avg_buy_price) VALUES (?, ?, ?, ?, ?)',
      ).run(generateId(), userId, stockId, shares, stock.current_price);
    }

    // Record transaction
    const txnId = generateId();
    db.prepare(
      'INSERT INTO stock_transactions (id, user_id, stock_id, type, shares, price, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(txnId, userId, stockId, 'buy', shares, stock.current_price, totalCost);

    incrementTradeCount(userId);
    return txnId;
  });

  const txnId = txn();
  logger.info({ userId, stockId, shares, price: stock.current_price }, 'Shares bought');
  return getTransactionById(txnId)!;
}

// ─── Sell Shares ───

export function sellShares(
  userId: string,
  stockId: string,
  shares: number,
  isPremium: boolean,
): StockTransaction {
  if (shares <= 0) throw new Error('매도 수량은 1 이상이어야 합니다.');

  const limitCheck = checkTradeLimit(userId, isPremium);
  if (!limitCheck.allowed) throw new Error(limitCheck.message);

  const stock = getStockById(stockId);
  if (!stock) throw new Error('주식 정보를 찾을 수 없습니다.');

  const db = getDb();
  const ownership = db
    .prepare('SELECT * FROM stock_ownership WHERE user_id = ? AND stock_id = ?')
    .get(userId, stockId) as StockOwnership | undefined;

  if (!ownership || ownership.shares_owned < shares) {
    throw new Error(`보유 주식이 부족합니다. 보유: ${ownership?.shares_owned ?? 0}주`);
  }

  const totalRevenue = Math.round(stock.current_price * shares);

  const txn = db.transaction(() => {
    // Add gold
    earnGold(userId, totalRevenue, 'stock_sell', `주식 매도: ${shares}주 × ${stock.current_price}골드`);

    // Update available shares
    db.prepare('UPDATE agent_stocks SET available_shares = available_shares + ? WHERE id = ?').run(shares, stockId);

    // Update ownership
    const remaining = ownership.shares_owned - shares;
    if (remaining === 0) {
      db.prepare('DELETE FROM stock_ownership WHERE id = ?').run(ownership.id);
    } else {
      db.prepare('UPDATE stock_ownership SET shares_owned = ? WHERE id = ?').run(remaining, ownership.id);
    }

    // Record transaction
    const txnId = generateId();
    db.prepare(
      'INSERT INTO stock_transactions (id, user_id, stock_id, type, shares, price, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(txnId, userId, stockId, 'sell', shares, stock.current_price, totalRevenue);

    incrementTradeCount(userId);
    return txnId;
  });

  const txnId = txn();
  logger.info({ userId, stockId, shares, price: stock.current_price }, 'Shares sold');
  return getTransactionById(txnId)!;
}

// ─── Price Fluctuation Engine ───

export function applyDebateResult(agentId: string, result: 'win' | 'loss' | 'draw'): void {
  const db = getDb();
  const stock = db.prepare('SELECT * FROM agent_stocks WHERE agent_id = ?').get(agentId) as
    | AgentStock
    | undefined;
  if (!stock) return; // Not listed

  let changePct: number;
  if (result === 'win') {
    changePct = 0.03 + Math.random() * 0.05; // +3% to +8%
  } else if (result === 'loss') {
    changePct = -(0.02 + Math.random() * 0.03); // -2% to -5%
  } else {
    changePct = (Math.random() - 0.5) * 0.02; // -1% to +1%
  }

  const newPrice = Math.max(1, Math.round(stock.current_price * (1 + changePct) * 100) / 100);
  const marketCap = newPrice * stock.total_shares;

  db.prepare(
    'UPDATE agent_stocks SET current_price = ?, market_cap = ?, price_change_24h = ? WHERE id = ?',
  ).run(newPrice, marketCap, Math.round(changePct * 10000) / 100, stock.id);

  // Pay dividends on win
  if (result === 'win') {
    payDividends(stock.id, stock.dividend_per_win);
  }

  logger.debug({ agentId, result, newPrice, changePct: `${(changePct * 100).toFixed(2)}%` }, 'Stock price updated');
}

export function applyNaturalFluctuation(): void {
  const db = getDb();
  const stocks = db.prepare('SELECT * FROM agent_stocks').all() as AgentStock[];

  for (const stock of stocks) {
    const noise = (Math.random() - 0.5) * 0.01; // ±0.5%
    const newPrice = Math.max(1, Math.round(stock.current_price * (1 + noise) * 100) / 100);
    db.prepare('UPDATE agent_stocks SET current_price = ?, market_cap = ? WHERE id = ?').run(
      newPrice,
      newPrice * stock.total_shares,
      stock.id,
    );
  }
}

// ─── Dividends ───

function payDividends(stockId: string, amountPerShare: number): void {
  const db = getDb();
  const owners = db.prepare('SELECT * FROM stock_ownership WHERE stock_id = ?').all(stockId) as StockOwnership[];

  for (const owner of owners) {
    const dividend = amountPerShare * owner.shares_owned;
    try {
      earnGold(owner.user_id, dividend, 'stock_dividend', `배당금: ${owner.shares_owned}주 × ${amountPerShare}골드`);
    } catch {
      // Skip if user doesn't exist
    }
  }
}

// ─── Queries ───

export function getStockById(id: string): AgentStock | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM agent_stocks WHERE id = ?').get(id) as AgentStock | undefined) ?? null;
}

export function getStockByAgentId(agentId: string): AgentStock | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM agent_stocks WHERE agent_id = ?').get(agentId) as AgentStock | undefined) ?? null;
}

export function getAllStocks(): AgentStock[] {
  const db = getDb();
  return db.prepare('SELECT * FROM agent_stocks ORDER BY market_cap DESC').all() as AgentStock[];
}

export function getUserPortfolio(userId: string): (StockOwnership & { current_price: number; agent_name: string })[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT so.*, s.current_price, a.name as agent_name
       FROM stock_ownership so
       JOIN agent_stocks s ON so.stock_id = s.id
       JOIN agents a ON s.agent_id = a.id
       WHERE so.user_id = ?
       ORDER BY so.shares_owned * s.current_price DESC`,
    )
    .all(userId) as (StockOwnership & { current_price: number; agent_name: string })[];
}

export function getUserTransactions(userId: string, limit: number = 20): StockTransaction[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM stock_transactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?')
    .all(userId, limit) as StockTransaction[];
}

function getTransactionById(id: string): StockTransaction | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM stock_transactions WHERE id = ?').get(id) as StockTransaction | undefined) ?? null;
}
