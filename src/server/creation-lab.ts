/**
 * creation-lab.ts — Agent Creation & Management (Module 4.1)
 * ============================================================
 * CRUD for AI agents with ELO, tier promotion, faction assignment.
 */

import { getDb, generateId } from './db.js';
import { INITIAL_ELO, getTierFromElo, type Tier } from './elo.js';
import { checkAgentLimit } from './rate-limiter.js';
import { logger } from './logger.js';

// ─── Types ───

export interface Agent {
  id: string;
  name: string;
  persona: string;
  philosophy: string;
  faction: string;
  elo_score: number;
  tier: Tier;
  total_debates: number;
  wins: number;
  losses: number;
  draws: number;
  owner_id: string;
  created_at: string;
}

export interface CreateAgentInput {
  name: string;
  persona: string;
  philosophy: string;
  faction: string;
}

export const FACTIONS = [
  '합리주의',
  '경험주의',
  '실용주의',
  '이상주의',
  '실존주의',
  '공리주의',
] as const;

export type Faction = (typeof FACTIONS)[number];

// ─── Create Agent ───

export function createAgent(
  ownerId: string,
  isPremium: boolean,
  input: CreateAgentInput,
): Agent {
  // Rate limit check
  const limit = checkAgentLimit(ownerId, isPremium);
  if (!limit.allowed) {
    throw new Error(limit.message);
  }

  // Validate faction
  if (!FACTIONS.includes(input.faction as Faction)) {
    throw new Error(`유효하지 않은 팩션입니다. 가능한 팩션: ${FACTIONS.join(', ')}`);
  }

  if (!input.name.trim() || !input.persona.trim() || !input.philosophy.trim()) {
    throw new Error('이름, 페르소나, 철학은 필수 입력입니다.');
  }

  const db = getDb();
  const id = generateId();
  const tier = getTierFromElo(INITIAL_ELO);

  db.prepare(
    `INSERT INTO agents (id, name, persona, philosophy, faction, elo_score, tier, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name.trim(), input.persona.trim(), input.philosophy.trim(), input.faction, INITIAL_ELO, tier, ownerId);

  logger.info({ agentId: id, name: input.name, ownerId }, 'Agent created');

  return getAgentById(id)!;
}

// ─── Read Agents ───

export function getAgentById(id: string): Agent | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Agent | undefined;
  return row ?? null;
}

export function getAgentsByOwner(ownerId: string): Agent[] {
  const db = getDb();
  return db.prepare('SELECT * FROM agents WHERE owner_id = ? ORDER BY elo_score DESC').all(ownerId) as Agent[];
}

export interface AgentListOptions {
  faction?: string;
  tier?: string;
  sortBy?: 'elo_score' | 'wins' | 'created_at';
  limit?: number;
  offset?: number;
}

export function listAgents(options: AgentListOptions = {}): { agents: Agent[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.faction) {
    conditions.push('faction = ?');
    params.push(options.faction);
  }
  if (options.tier) {
    conditions.push('tier = ?');
    params.push(options.tier);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortBy = options.sortBy ?? 'elo_score';
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM agents ${where}`).get(...params) as { count: number }
  ).count;

  const agents = db
    .prepare(`SELECT * FROM agents ${where} ORDER BY ${sortBy} DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Agent[];

  return { agents, total };
}

// ─── Update Tier ───

export function updateAgentTier(agentId: string): Tier {
  const db = getDb();
  const agent = getAgentById(agentId);
  if (!agent) throw new Error('에이전트를 찾을 수 없습니다.');

  const newTier = getTierFromElo(agent.elo_score);
  if (newTier !== agent.tier) {
    db.prepare('UPDATE agents SET tier = ? WHERE id = ?').run(newTier, agentId);
    logger.info({ agentId, oldTier: agent.tier, newTier }, 'Agent tier updated');
  }
  return newTier;
}

// ─── Update Stats After Debate ───

export function updateAgentAfterDebate(
  agentId: string,
  result: 'win' | 'loss' | 'draw',
  newElo: number,
): void {
  const db = getDb();
  const field = result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws';

  db.prepare(
    `UPDATE agents SET 
       elo_score = ?, 
       total_debates = total_debates + 1,
       ${field} = ${field} + 1
     WHERE id = ?`,
  ).run(newElo, agentId);

  updateAgentTier(agentId);
}

// ─── Leaderboard ───

export function getLeaderboard(limit: number = 10): Agent[] {
  const db = getDb();
  return db.prepare('SELECT * FROM agents ORDER BY elo_score DESC LIMIT ?').all(limit) as Agent[];
}
