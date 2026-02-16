/**
 * rate-limiter.ts — Free/Premium Usage Rate Limiter
 * ===================================================
 * Enforces daily limits for debates and trades.
 */

import { getDb } from './db.js';
import { logger } from './logger.js';

// ─── Limits ───

interface TierLimits {
  debatesPerDay: number;
  tradesPerDay: number;
  maxAgents: number;
}

const FREE_LIMITS: TierLimits = {
  debatesPerDay: 50,
  tradesPerDay: 10,
  maxAgents: 3,
};

const PREMIUM_LIMITS: TierLimits = {
  debatesPerDay: 500,
  tradesPerDay: Infinity,
  maxAgents: Infinity,
};

function getLimits(isPremium: boolean): TierLimits {
  return isPremium ? PREMIUM_LIMITS : FREE_LIMITS;
}

// ─── Usage Checking ───

function ensureTracking(userId: string): void {
  const db = getDb();
  const row = db.prepare('SELECT user_id FROM usage_tracking WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare('INSERT INTO usage_tracking (user_id) VALUES (?)').run(userId);
  }
}

function resetIfNewDay(userId: string, field: 'debate' | 'trade'): void {
  const db = getDb();
  const dateColumn = field === 'debate' ? 'last_debate_date' : 'last_trade_date';
  const countColumn = field === 'debate' ? 'debates_today' : 'trades_today';
  const today = new Date().toISOString().slice(0, 10);

  const row = db.prepare(`SELECT ${dateColumn} FROM usage_tracking WHERE user_id = ?`).get(userId) as
    | Record<string, string>
    | undefined;

  if (row && row[dateColumn] !== today) {
    db.prepare(
      `UPDATE usage_tracking SET ${countColumn} = 0, ${dateColumn} = ? WHERE user_id = ?`,
    ).run(today, userId);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  message: string;
}

export function checkDebateLimit(userId: string, isPremium: boolean): RateLimitResult {
  ensureTracking(userId);
  resetIfNewDay(userId, 'debate');

  const db = getDb();
  const limits = getLimits(isPremium);
  const row = db.prepare('SELECT debates_today FROM usage_tracking WHERE user_id = ?').get(userId) as
    | { debates_today: number }
    | undefined;
  const used = row?.debates_today ?? 0;
  const remaining = Math.max(0, limits.debatesPerDay - used);

  if (used >= limits.debatesPerDay) {
    return {
      allowed: false,
      remaining: 0,
      limit: limits.debatesPerDay,
      message: `오늘의 토론 참여 횟수(${limits.debatesPerDay}회)를 초과했습니다.${isPremium ? '' : ' 프리미엄으로 업그레이드하면 500회까지 가능합니다!'}`,
    };
  }

  return { allowed: true, remaining, limit: limits.debatesPerDay, message: '' };
}

export function checkTradeLimit(userId: string, isPremium: boolean): RateLimitResult {
  ensureTracking(userId);
  resetIfNewDay(userId, 'trade');

  const db = getDb();
  const limits = getLimits(isPremium);

  if (limits.tradesPerDay === Infinity) {
    return { allowed: true, remaining: Infinity, limit: Infinity, message: '' };
  }

  const row = db.prepare('SELECT trades_today FROM usage_tracking WHERE user_id = ?').get(userId) as
    | { trades_today: number }
    | undefined;
  const used = row?.trades_today ?? 0;
  const remaining = Math.max(0, limits.tradesPerDay - used);

  if (used >= limits.tradesPerDay) {
    return {
      allowed: false,
      remaining: 0,
      limit: limits.tradesPerDay,
      message: `오늘의 거래 횟수(${limits.tradesPerDay}회)를 초과했습니다. 프리미엄으로 업그레이드하면 무제한 거래가 가능합니다!`,
    };
  }

  return { allowed: true, remaining, limit: limits.tradesPerDay, message: '' };
}

export function checkAgentLimit(userId: string, isPremium: boolean): RateLimitResult {
  const db = getDb();
  const limits = getLimits(isPremium);

  if (limits.maxAgents === Infinity) {
    return { allowed: true, remaining: Infinity, limit: Infinity, message: '' };
  }

  const row = db.prepare('SELECT COUNT(*) as count FROM agents WHERE owner_id = ?').get(userId) as
    | { count: number };
  const count = row.count;
  const remaining = Math.max(0, limits.maxAgents - count);

  if (count >= limits.maxAgents) {
    return {
      allowed: false,
      remaining: 0,
      limit: limits.maxAgents,
      message: `에이전트는 최대 ${limits.maxAgents}개까지 생성할 수 있습니다. 프리미엄으로 업그레이드하면 무제한 생성이 가능합니다!`,
    };
  }

  return { allowed: true, remaining, limit: limits.maxAgents, message: '' };
}

export function incrementDebateCount(userId: string): void {
  ensureTracking(userId);
  resetIfNewDay(userId, 'debate');
  getDb().prepare('UPDATE usage_tracking SET debates_today = debates_today + 1 WHERE user_id = ?').run(userId);
  logger.debug({ userId }, 'Debate count incremented');
}

export function incrementTradeCount(userId: string): void {
  ensureTracking(userId);
  resetIfNewDay(userId, 'trade');
  getDb().prepare('UPDATE usage_tracking SET trades_today = trades_today + 1 WHERE user_id = ?').run(userId);
  logger.debug({ userId }, 'Trade count incremented');
}
