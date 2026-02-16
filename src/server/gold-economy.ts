/**
 * gold-economy.ts — Gold Economy System
 * ========================================
 * Single virtual currency for the entire platform.
 * Manages balance, earn, spend, and audit log.
 */

import { getDb, generateId } from './db.js';
import { logger } from './logger.js';

// ─── Types ───

export type GoldTransactionType =
  | 'signup_bonus'
  | 'daily_quest'
  | 'debate_win'
  | 'bounty_reward'
  | 'vote_reward'
  | 'event_reward'
  | 'premium_monthly'
  | 'stock_buy'
  | 'stock_sell'
  | 'stock_dividend'
  | 'bounty_create'
  | 'customization'
  | 'admin_adjust';

// ─── Balance ───

export function getGoldBalance(userId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT gold_balance FROM users WHERE id = ?').get(userId) as
    | { gold_balance: number }
    | undefined;
  return row?.gold_balance ?? 0;
}

// ─── Earn Gold ───

export function earnGold(
  userId: string,
  amount: number,
  type: GoldTransactionType,
  description: string = '',
): { newBalance: number } {
  if (amount <= 0) {
    throw new Error('골드 획득량은 0보다 커야 합니다.');
  }

  const db = getDb();
  const txn = db.transaction(() => {
    db.prepare('UPDATE users SET gold_balance = gold_balance + ? WHERE id = ?').run(amount, userId);

    db.prepare(
      'INSERT INTO gold_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)',
    ).run(generateId(), userId, amount, type, description);

    const row = db.prepare('SELECT gold_balance FROM users WHERE id = ?').get(userId) as
      | { gold_balance: number };
    return row.gold_balance;
  });

  const newBalance = txn();
  logger.info({ userId, amount, type, newBalance }, 'Gold earned');
  return { newBalance };
}

// ─── Spend Gold ───

export function spendGold(
  userId: string,
  amount: number,
  type: GoldTransactionType,
  description: string = '',
): { newBalance: number } {
  if (amount <= 0) {
    throw new Error('골드 사용량은 0보다 커야 합니다.');
  }

  const db = getDb();
  const txn = db.transaction(() => {
    const row = db.prepare('SELECT gold_balance FROM users WHERE id = ?').get(userId) as
      | { gold_balance: number }
      | undefined;
    const current = row?.gold_balance ?? 0;

    if (current < amount) {
      throw new Error(`골드가 부족합니다. 보유: ${current}골드, 필요: ${amount}골드`);
    }

    db.prepare('UPDATE users SET gold_balance = gold_balance - ? WHERE id = ?').run(amount, userId);

    db.prepare(
      'INSERT INTO gold_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)',
    ).run(generateId(), userId, -amount, type, description);

    const updated = db.prepare('SELECT gold_balance FROM users WHERE id = ?').get(userId) as
      | { gold_balance: number };
    return updated.gold_balance;
  });

  const newBalance = txn();
  logger.info({ userId, amount, type, newBalance }, 'Gold spent');
  return { newBalance };
}

// ─── Transaction History ───

export interface GoldTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  timestamp: string;
}

export function getGoldHistory(
  userId: string,
  limit: number = 50,
): GoldTransaction[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT id, amount, type, description, timestamp FROM gold_transactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
    )
    .all(userId, limit) as GoldTransaction[];
}
