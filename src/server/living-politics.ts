/**
 * living-politics.ts — Governance & Events (Module 4.5)
 * ======================================================
 * 3-tier governance, world events, Daily Prophet news,
 * and community polls. Adds depth and replayability.
 */

import { getDb, generateId } from './db.js';
import { callLLM, buildProphetPrompt } from './llm.js';
import { earnGold } from './gold-economy.js';
import { logger } from './logger.js';

// ─── Types ───

export interface WorldEvent {
  id: string;
  title: string;
  description: string;
  type: 'ai' | 'community' | 'admin';
  effects: Record<string, unknown>;
  intensity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string | null;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  votes_per_option: number[];
  total_voters: number;
  status: 'open' | 'closed';
  deadline: string | null;
  created_at: string;
}

export interface DailyProphetArticle {
  title: string;
  content: string;
  generated_at: string;
}

// ─── Events ───

export function createEvent(
  title: string,
  description: string,
  type: 'ai' | 'community' | 'admin',
  intensity: WorldEvent['intensity'] = 'medium',
  expiresInHours: number = 24,
): WorldEvent {
  const db = getDb();
  const id = generateId();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO events (id, title, description, type, intensity, status, expires_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
  ).run(id, title, description, type, intensity, expiresAt);

  logger.info({ eventId: id, title, type }, 'World event created');
  return getEventById(id)!;
}

export function getEventById(id: string): WorldEvent | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as
    | (Omit<WorldEvent, 'effects'> & { effects: string })
    | undefined;
  if (!row) return null;
  return { ...row, effects: JSON.parse(row.effects) as Record<string, unknown> };
}

export function getActiveEvents(): WorldEvent[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM events WHERE status = 'active' ORDER BY created_at DESC")
    .all() as (Omit<WorldEvent, 'effects'> & { effects: string })[];
  return rows.map((r) => ({ ...r, effects: JSON.parse(r.effects) as Record<string, unknown> }));
}

export function expireOldEvents(): number {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE events SET status = 'expired' WHERE status = 'active' AND expires_at < datetime('now')",
    )
    .run();
  return result.changes;
}

// ─── Polls ───

export function createPoll(
  question: string,
  options: string[],
  deadlineHours: number = 24,
): Poll {
  if (options.length < 2) throw new Error('투표 선택지는 최소 2개 이상이어야 합니다.');
  if (!question.trim()) throw new Error('질문을 입력해주세요.');

  const db = getDb();
  const id = generateId();
  const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString();
  const votesPerOption = options.map(() => 0);

  db.prepare(
    `INSERT INTO polls (id, question, options, votes_per_option, status, deadline)
     VALUES (?, ?, ?, ?, 'open', ?)`,
  ).run(id, question.trim(), JSON.stringify(options), JSON.stringify(votesPerOption), deadline);

  logger.info({ pollId: id, question }, 'Poll created');
  return getPollById(id)!;
}

export function voteOnPoll(pollId: string, userId: string, optionIndex: number): void {
  const poll = getPollById(pollId);
  if (!poll) throw new Error('투표를 찾을 수 없습니다.');
  if (poll.status !== 'open') throw new Error('이 투표는 이미 마감되었습니다.');
  if (optionIndex < 0 || optionIndex >= poll.options.length) throw new Error('유효하지 않은 선택지입니다.');

  const db = getDb();

  // Check duplicate vote
  const existing = db.prepare('SELECT id FROM poll_votes WHERE poll_id = ? AND user_id = ?').get(pollId, userId);
  if (existing) throw new Error('이미 투표하셨습니다.');

  db.prepare('INSERT INTO poll_votes (id, poll_id, user_id, option_index) VALUES (?, ?, ?, ?)').run(
    generateId(),
    pollId,
    userId,
    optionIndex,
  );

  // Update vote counts
  poll.votes_per_option[optionIndex]++;
  db.prepare('UPDATE polls SET votes_per_option = ?, total_voters = total_voters + 1 WHERE id = ?').run(
    JSON.stringify(poll.votes_per_option),
    pollId,
  );

  // Reward voter
  try {
    earnGold(userId, 10, 'vote_reward', '커뮤니티 투표 참여 보상');
  } catch {
    // Ignore errors
  }
}

export function getPollById(id: string): Poll | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM polls WHERE id = ?').get(id) as
    | (Omit<Poll, 'options' | 'votes_per_option'> & { options: string; votes_per_option: string })
    | undefined;
  if (!row) return null;
  return {
    ...row,
    options: JSON.parse(row.options) as string[],
    votes_per_option: JSON.parse(row.votes_per_option) as number[],
  };
}

export function getActivePolls(): Poll[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM polls WHERE status = 'open' ORDER BY created_at DESC")
    .all() as (Omit<Poll, 'options' | 'votes_per_option'> & { options: string; votes_per_option: string })[];
  return rows.map((r) => ({
    ...r,
    options: JSON.parse(r.options) as string[],
    votes_per_option: JSON.parse(r.votes_per_option) as number[],
  }));
}

// ─── Daily Prophet ───

export async function generateDailyProphet(): Promise<DailyProphetArticle> {
  const db = getDb();

  // Gather today's data
  const recentDebates = db
    .prepare(
      `SELECT d.topic, d.winner_id, a.name as winner_name, d.judge_reasoning
       FROM debates d LEFT JOIN agents a ON d.winner_id = a.id
       WHERE d.status = 'completed'
       ORDER BY d.completed_at DESC LIMIT 5`,
    )
    .all() as { topic: string; winner_name: string; judge_reasoning: string }[];

  const topStocks = db
    .prepare(
      `SELECT s.current_price, s.price_change_24h, a.name as agent_name
       FROM agent_stocks s JOIN agents a ON s.agent_id = a.id
       ORDER BY s.market_cap DESC LIMIT 5`,
    )
    .all() as { current_price: number; price_change_24h: number; agent_name: string }[];

  const activeEvents = getActiveEvents();

  const context = `
오늘의 토론 결과:
${recentDebates.map((d) => `- 주제: "${d.topic}" → 승자: ${d.winner_name}`).join('\n') || '- 아직 토론이 없습니다'}

주가 현황:
${topStocks.map((s) => `- ${s.agent_name}: ${s.current_price}골드 (${s.price_change_24h > 0 ? '+' : ''}${s.price_change_24h}%)`).join('\n') || '- 상장된 에이전트가 없습니다'}

진행 중인 이벤트:
${activeEvents.map((e) => `- ${e.title}: ${e.description}`).join('\n') || '- 특별한 이벤트가 없습니다'}
`.trim();

  try {
    const prophetPrompt = buildProphetPrompt();
    const content = await callLLM({
      systemPrompt: prophetPrompt,
      userPrompt: `아래 데이터를 바탕으로 오늘의 아고라 뉴스를 작성해주세요:\n\n${context}`,
      maxTokens: 768,
      temperature: 0.9,
    });

    const article: DailyProphetArticle = {
      title: '📰 오늘의 아고라 소식',
      content,
      generated_at: new Date().toISOString(),
    };

    logger.info('Daily Prophet generated');
    return article;
  } catch (error) {
    logger.error({ error }, 'Failed to generate Daily Prophet');
    return {
      title: '📰 오늘의 아고라 소식',
      content: '오늘의 뉴스를 생성하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      generated_at: new Date().toISOString(),
    };
  }
}
