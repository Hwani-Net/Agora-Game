/**
 * db.ts — SQLite Database Schema & Connection
 * =============================================
 * Single-file DB using better-sqlite3. All tables for
 * User, Agent, Debate, Stock, Quest, Event, Poll, UsageTracking.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { logger } from './logger.js';

const DB_PATH = path.resolve(process.cwd(), 'agora.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    logger.info({ path: DB_PATH }, 'Database connected');
  }
  return _db;
}

// ─── Schema Initialization ───

export function initializeSchema(): void {
  const db = getDb();

  db.exec(`
    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      provider TEXT DEFAULT 'google',
      gold_balance INTEGER DEFAULT 1000,
      is_premium INTEGER DEFAULT 0,
      premium_expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- AI Agents
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      persona TEXT NOT NULL,
      philosophy TEXT NOT NULL,
      faction TEXT NOT NULL,
      elo_score INTEGER DEFAULT 1000,
      tier TEXT DEFAULT 'Bronze',
      total_debates INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0,
      owner_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    -- Debates
    CREATE TABLE IF NOT EXISTS debates (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      agent1_id TEXT NOT NULL,
      agent2_id TEXT NOT NULL,
      rounds TEXT DEFAULT '[]',
      judge_reasoning TEXT DEFAULT '',
      winner_id TEXT,
      elo_change_winner INTEGER DEFAULT 0,
      elo_change_loser INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (agent1_id) REFERENCES agents(id),
      FOREIGN KEY (agent2_id) REFERENCES agents(id)
    );

    -- Agent Stocks
    CREATE TABLE IF NOT EXISTS agent_stocks (
      id TEXT PRIMARY KEY,
      agent_id TEXT UNIQUE NOT NULL,
      current_price REAL DEFAULT 1000.0,
      total_shares INTEGER DEFAULT 1000,
      available_shares INTEGER DEFAULT 1000,
      market_cap REAL DEFAULT 1000000.0,
      price_change_24h REAL DEFAULT 0.0,
      dividend_per_win INTEGER DEFAULT 10,
      ipo_date TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    -- Stock Ownership
    CREATE TABLE IF NOT EXISTS stock_ownership (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stock_id TEXT NOT NULL,
      shares_owned INTEGER DEFAULT 0,
      avg_buy_price REAL DEFAULT 0.0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (stock_id) REFERENCES agent_stocks(id),
      UNIQUE(user_id, stock_id)
    );

    -- Stock Transactions
    CREATE TABLE IF NOT EXISTS stock_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stock_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
      shares INTEGER NOT NULL,
      price REAL NOT NULL,
      total_amount REAL NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (stock_id) REFERENCES agent_stocks(id)
    );

    -- Quests
    CREATE TABLE IF NOT EXISTS quests (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('daily', 'bounty')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reward_gold INTEGER DEFAULT 100,
      difficulty TEXT DEFAULT 'Normal' CHECK(difficulty IN ('Easy', 'Normal', 'Hard', 'Insane')),
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'completed', 'expired')),
      creator_id TEXT,
      solver_agent_id TEXT,
      deadline TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (creator_id) REFERENCES users(id),
      FOREIGN KEY (solver_agent_id) REFERENCES agents(id)
    );

    -- Bounty Submissions
    CREATE TABLE IF NOT EXISTS bounty_submissions (
      id TEXT PRIMARY KEY,
      quest_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      answer_content TEXT NOT NULL,
      votes INTEGER DEFAULT 0,
      submitted_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (quest_id) REFERENCES quests(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    -- Events
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ai', 'community', 'admin')),
      effects TEXT DEFAULT '{}',
      intensity TEXT DEFAULT 'medium' CHECK(intensity IN ('low', 'medium', 'high', 'critical')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'cancelled')),
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    );

    -- Polls
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      options TEXT NOT NULL DEFAULT '[]',
      votes_per_option TEXT NOT NULL DEFAULT '[]',
      total_voters INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      deadline TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Poll Votes (track who voted)
    CREATE TABLE IF NOT EXISTS poll_votes (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      voted_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (poll_id) REFERENCES polls(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(poll_id, user_id)
    );

    -- Usage Tracking (Rate Limiting)
    CREATE TABLE IF NOT EXISTS usage_tracking (
      user_id TEXT PRIMARY KEY,
      debates_today INTEGER DEFAULT 0,
      trades_today INTEGER DEFAULT 0,
      last_debate_date TEXT DEFAULT (date('now')),
      last_trade_date TEXT DEFAULT (date('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Gold Transactions (audit log)
    CREATE TABLE IF NOT EXISTS gold_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT DEFAULT '',
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_agents_elo ON agents(elo_score DESC);
    CREATE INDEX IF NOT EXISTS idx_debates_status ON debates(status);
    CREATE INDEX IF NOT EXISTS idx_stock_agent ON agent_stocks(agent_id);
    CREATE INDEX IF NOT EXISTS idx_quests_type ON quests(type, status);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
  `);

  logger.info('Database schema initialized');
}

// ─── ID Generator ───

export function generateId(): string {
  return crypto.randomUUID();
}
