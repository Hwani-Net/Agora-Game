/**
 * quest-board.ts — Quest & Bounty System (Module 4.4)
 * =====================================================
 * Daily quests for AI agent growth, bounty quests for user-initiated
 * questions with gold rewards and community voting.
 */

import { getDb, generateId } from './db.js';
import { callLLM, buildQuestPrompt } from './llm.js';
import { earnGold, spendGold } from './gold-economy.js';
import { logger } from './logger.js';

// ─── Types ───

export interface Quest {
  id: string;
  type: 'daily' | 'bounty';
  title: string;
  description: string;
  reward_gold: number;
  difficulty: 'Easy' | 'Normal' | 'Hard' | 'Insane';
  status: 'open' | 'in_progress' | 'completed' | 'expired';
  creator_id: string | null;
  solver_agent_id: string | null;
  deadline: string | null;
  created_at: string;
}

export interface BountySubmission {
  id: string;
  quest_id: string;
  agent_id: string;
  answer_content: string;
  votes: number;
  submitted_at: string;
}

const DIFFICULTY_REWARDS: Record<string, number> = {
  Easy: 50,
  Normal: 100,
  Hard: 200,
  Insane: 500,
};

// ─── Daily Quest Generation ───

export async function generateDailyQuest(): Promise<Quest> {
  const db = getDb();

  try {
    const promptText = buildQuestPrompt();
    const raw = await callLLM({
      systemPrompt: promptText,
      userPrompt: '오늘의 데일리 퀘스트를 하나 생성해주세요. 철학, 시사, 경제, 윤리 중 하나의 주제로.',
      maxTokens: 256,
      temperature: 1.0,
    });

    let parsed: { title: string; description: string; difficulty: string };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? raw);
    } catch {
      parsed = { title: '오늘의 철학 질문', description: raw.slice(0, 200), difficulty: 'Normal' };
    }

    const difficulty = (['Easy', 'Normal', 'Hard', 'Insane'].includes(parsed.difficulty)
      ? parsed.difficulty
      : 'Normal') as Quest['difficulty'];

    const id = generateId();
    const reward = DIFFICULTY_REWARDS[difficulty];

    db.prepare(
      `INSERT INTO quests (id, type, title, description, reward_gold, difficulty, status)
       VALUES (?, 'daily', ?, ?, ?, ?, 'open')`,
    ).run(id, parsed.title, parsed.description, reward, difficulty);

    logger.info({ questId: id, title: parsed.title }, 'Daily quest generated');
    return getQuestById(id)!;
  } catch (error) {
    logger.error({ error }, 'Failed to generate daily quest, using fallback');
    // Fallback: static quest
    const id = generateId();
    db.prepare(
      `INSERT INTO quests (id, type, title, description, reward_gold, difficulty, status)
       VALUES (?, 'daily', ?, ?, ?, 'Normal', 'open')`,
    ).run(id, '오늘의 철학 토론', '행복의 정의에 대해 자신의 철학적 관점을 서술하세요.', 100);
    return getQuestById(id)!;
  }
}

// ─── Bounty Quest ───

export function createBountyQuest(
  creatorId: string,
  title: string,
  description: string,
  rewardGold: number,
  deadlineHours: number = 24,
): Quest {
  if (rewardGold < 100) throw new Error('현상금은 최소 100골드 이상이어야 합니다.');
  if (!title.trim() || !description.trim()) throw new Error('제목과 설명은 필수입니다.');

  // Deduct gold from creator
  spendGold(creatorId, rewardGold, 'bounty_create', `현상금 퀘스트 등록: "${title}"`);

  const db = getDb();
  const id = generateId();
  const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO quests (id, type, title, description, reward_gold, difficulty, status, creator_id, deadline)
     VALUES (?, 'bounty', ?, ?, ?, 'Normal', 'open', ?, ?)`,
  ).run(id, title.trim(), description.trim(), rewardGold, creatorId, deadline);

  logger.info({ questId: id, creatorId, rewardGold }, 'Bounty quest created');
  return getQuestById(id)!;
}

// ─── Submit Answer ───

export function submitBountyAnswer(
  questId: string,
  agentId: string,
  answerContent: string,
): BountySubmission {
  const quest = getQuestById(questId);
  if (!quest) throw new Error('퀘스트를 찾을 수 없습니다.');
  if (quest.type !== 'bounty') throw new Error('현상금 퀘스트만 답변을 제출할 수 있습니다.');
  if (quest.status !== 'open') throw new Error('이 퀘스트는 이미 마감되었습니다.');

  const db = getDb();
  // Check duplicate
  const existing = db
    .prepare('SELECT id FROM bounty_submissions WHERE quest_id = ? AND agent_id = ?')
    .get(questId, agentId);
  if (existing) throw new Error('이 에이전트는 이미 답변을 제출했습니다.');

  const id = generateId();
  db.prepare(
    'INSERT INTO bounty_submissions (id, quest_id, agent_id, answer_content) VALUES (?, ?, ?, ?)',
  ).run(id, questId, agentId, answerContent.trim());

  logger.info({ questId, agentId }, 'Bounty answer submitted');
  return getSubmissionById(id)!;
}

// ─── Vote ───

export function voteForSubmission(submissionId: string, userId: string): void {
  const db = getDb();
  const submission = getSubmissionById(submissionId);
  if (!submission) throw new Error('답변을 찾을 수 없습니다.');

  db.prepare('UPDATE bounty_submissions SET votes = votes + 1 WHERE id = ?').run(submissionId);

  // Reward voter (10 gold for participation)
  try {
    earnGold(userId, 10, 'vote_reward', '퀘스트 투표 참여 보상');
  } catch {
    // Ignore errors
  }
}

// ─── Close Bounty ───

export function closeBountyQuest(questId: string): BountySubmission | null {
  const quest = getQuestById(questId);
  if (!quest) throw new Error('퀘스트를 찾을 수 없습니다.');

  const db = getDb();
  const submissions = db
    .prepare('SELECT * FROM bounty_submissions WHERE quest_id = ? ORDER BY votes DESC LIMIT 1')
    .all(questId) as BountySubmission[];

  if (submissions.length === 0) {
    // No submissions — refund creator
    if (quest.creator_id) {
      earnGold(quest.creator_id, quest.reward_gold, 'bounty_reward', `현상금 환불: "${quest.title}"`);
    }
    db.prepare("UPDATE quests SET status = 'expired' WHERE id = ?").run(questId);
    return null;
  }

  const winner = submissions[0];

  // Award gold to winning agent's owner
  const agent = db.prepare('SELECT owner_id FROM agents WHERE id = ?').get(winner.agent_id) as
    | { owner_id: string }
    | undefined;
  if (agent) {
    earnGold(agent.owner_id, quest.reward_gold, 'bounty_reward', `현상금 퀘스트 입상: "${quest.title}"`);
  }

  db.prepare("UPDATE quests SET status = 'completed', solver_agent_id = ? WHERE id = ?").run(
    winner.agent_id,
    questId,
  );

  logger.info({ questId, winnerId: winner.agent_id }, 'Bounty quest closed');
  return winner;
}

// ─── Queries ───

export function getQuestById(id: string): Quest | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM quests WHERE id = ?').get(id) as Quest | undefined) ?? null;
}

export function listQuests(type?: 'daily' | 'bounty', status?: string): Quest[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: string[] = [];

  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM quests ${where} ORDER BY created_at DESC LIMIT 50`).all(...params) as Quest[];
}

export function getQuestSubmissions(questId: string): BountySubmission[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM bounty_submissions WHERE quest_id = ? ORDER BY votes DESC')
    .all(questId) as BountySubmission[];
}

function getSubmissionById(id: string): BountySubmission | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM bounty_submissions WHERE id = ?').get(id) as BountySubmission | undefined) ?? null;
}
