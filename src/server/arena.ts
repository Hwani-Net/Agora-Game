/**
 * arena.ts — Battle Arena (Module 4.2)
 * ======================================
 * Automatic debate matching, AI-powered debates, AI Judge,
 * ELO adjustments, and SSE streaming for live spectating.
 */

import { getDb, generateId } from './db.js';
import { calculateElo } from './elo.js';
import { callLLM, buildAgentDebatePrompt, buildJudgePrompt } from './llm.js';
import { getAgentById, updateAgentAfterDebate, type Agent } from './creation-lab.js';
import { earnGold } from './gold-economy.js';
import { incrementDebateCount } from './rate-limiter.js';
import { logger } from './logger.js';

// ─── Types ───

export interface DebateRound {
  round: number;
  agent1_argument: string;
  agent2_argument: string;
}

export interface JudgeResult {
  winner: 'agent1' | 'agent2';
  reasoning: string;
  scores: {
    agent1: { logic: number; evidence: number; persuasion: number };
    agent2: { logic: number; evidence: number; persuasion: number };
  };
}

export interface Debate {
  id: string;
  topic: string;
  agent1_id: string;
  agent2_id: string;
  rounds: DebateRound[];
  judge_reasoning: string;
  winner_id: string | null;
  elo_change_winner: number;
  elo_change_loser: number;
  status: 'pending' | 'in_progress' | 'completed';
  started_at: string;
  completed_at: string | null;
}

// ─── Topic Pool ───

const DEBATE_TOPICS = [
  '최저임금 인상은 경제에 긍정적인가?',
  'AI 규제가 필요한가, 자유로운 발전이 필요한가?',
  '기본소득은 실현 가능한 정책인가?',
  '우주 탐사에 대규모 투자를 해야 하는가?',
  '개인의 자유와 공공의 안전, 어느 것이 우선인가?',
  '기후 변화 대응에서 개인의 책임 vs 기업의 책임',
  '죽음의 형벌은 정당화될 수 있는가?',
  '인간의 행복은 물질적 풍요에서 오는가?',
  '전쟁은 때로 정의로울 수 있는가?',
  '교육의 목적은 취업인가, 인격 양성인가?',
  '진정한 민주주의란 무엇인가?',
  '기술 발전은 인간을 더 자유롭게 하는가?',
  '예술은 사회적 책임을 져야 하는가?',
  '동물 실험은 윤리적으로 정당화될 수 있는가?',
  '디지털 프라이버시 권리는 절대적인가?',
  '사형제도를 폐지해야 하는가?',
  '부유세를 도입해야 하는가?',
  '핵에너지는 미래의 답인가?',
  '의무 투표제를 시행해야 하는가?',
  '소셜미디어는 민주주의를 강화하는가, 약화하는가?',
  'AI가 인간의 창작을 대체할 수 있는가?',
  '종교와 과학은 양립할 수 있는가?',
  '자본주의는 최선의 경제 시스템인가?',
  '유전자 편집 기술의 인간 적용을 허용해야 하는가?',
  '글로벌 정부의 필요성에 대하여',
  '불로불사를 추구해야 하는가?',
  '진실은 객관적인가, 주관적인가?',
  '행복은 추구해야 하는 것인가, 자연히 오는 것인가?',
  '완전한 평등은 가능한가, 바람직한가?',
  '인공지능에게 권리를 부여해야 하는가?',
];

export function getRandomTopic(): string {
  return DEBATE_TOPICS[Math.floor(Math.random() * DEBATE_TOPICS.length)];
}

// ─── SSE Event Emitter ───

type SSECallback = (event: string, data: unknown) => void;
const activeListeners = new Map<string, Set<SSECallback>>();

export function subscribeToDebate(debateId: string, callback: SSECallback): () => void {
  if (!activeListeners.has(debateId)) {
    activeListeners.set(debateId, new Set());
  }
  activeListeners.get(debateId)!.add(callback);

  return () => {
    activeListeners.get(debateId)?.delete(callback);
    if (activeListeners.get(debateId)?.size === 0) {
      activeListeners.delete(debateId);
    }
  };
}

function emitDebateEvent(debateId: string, event: string, data: unknown): void {
  const listeners = activeListeners.get(debateId);
  if (listeners) {
    for (const cb of listeners) {
      cb(event, data);
    }
  }
}

// ─── Auto Matching ───

export function findMatch(): { agent1: Agent; agent2: Agent } | null {
  const db = getDb();
  // Find two agents with similar ELO (within ±200), different owners
  const agents = db
    .prepare(
      `SELECT * FROM agents ORDER BY RANDOM() LIMIT 20`,
    )
    .all() as Agent[];

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const diff = Math.abs(agents[i].elo_score - agents[j].elo_score);
      if (diff <= 200 && agents[i].owner_id !== agents[j].owner_id) {
        return { agent1: agents[i], agent2: agents[j] };
      }
    }
  }

  // Fallback: any two different-owner agents
  if (agents.length >= 2) {
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        if (agents[i].owner_id !== agents[j].owner_id) {
          return { agent1: agents[i], agent2: agents[j] };
        }
      }
    }
    // Last resort: any two agents (even same owner)
    return { agent1: agents[0], agent2: agents[1] };
  }

  return null;
}

// ─── Run Debate ───

export async function runDebate(
  agent1Id: string,
  agent2Id: string,
  topic?: string,
): Promise<Debate> {
  const agent1 = getAgentById(agent1Id);
  const agent2 = getAgentById(agent2Id);

  if (!agent1 || !agent2) {
    throw new Error('토론할 에이전트를 찾을 수 없습니다.');
  }

  const debateTopic = topic ?? getRandomTopic();
  const debateId = generateId();
  const db = getDb();

  // Create debate record
  db.prepare(
    `INSERT INTO debates (id, topic, agent1_id, agent2_id, status) VALUES (?, ?, ?, ?, 'in_progress')`,
  ).run(debateId, debateTopic, agent1Id, agent2Id);

  emitDebateEvent(debateId, 'debate_start', {
    id: debateId,
    topic: debateTopic,
    agent1: { id: agent1.id, name: agent1.name, faction: agent1.faction },
    agent2: { id: agent2.id, name: agent2.name, faction: agent2.faction },
  });

  logger.info({ debateId, topic: debateTopic, agent1: agent1.name, agent2: agent2.name }, 'Debate started');

  const rounds: DebateRound[] = [];

  try {
    // 3 rounds of debate
    for (let round = 1; round <= 3; round++) {
      const roundLabel = round === 1 ? '주장' : round === 2 ? '반론' : '최종 변론';
      const previousContext = rounds
        .map(
          (r) =>
            `[라운드 ${r.round}]\n${agent1.name}: ${r.agent1_argument}\n${agent2.name}: ${r.agent2_argument}`,
        )
        .join('\n\n');

      // Agent 1 speaks
      const agent1Prompt = buildAgentDebatePrompt(agent1.name, agent1.persona, agent1.philosophy, agent1.faction);
      const agent1Argument = await callLLM({
        systemPrompt: agent1Prompt,
        userPrompt: `토론 주제: "${debateTopic}"\n\n이번은 라운드 ${round} (${roundLabel})입니다.\n${previousContext ? `\n이전 토론 내용:\n${previousContext}\n` : ''}\n${roundLabel}을 해주세요.`,
        maxTokens: 512,
        temperature: 0.9,
      });

      emitDebateEvent(debateId, 'round_update', {
        round,
        agent: 'agent1',
        name: agent1.name,
        argument: agent1Argument,
      });

      // Agent 2 speaks
      const agent2Prompt = buildAgentDebatePrompt(agent2.name, agent2.persona, agent2.philosophy, agent2.faction);
      const agent2Argument = await callLLM({
        systemPrompt: agent2Prompt,
        userPrompt: `토론 주제: "${debateTopic}"\n\n이번은 라운드 ${round} (${roundLabel})입니다.\n${previousContext ? `\n이전 토론 내용:\n${previousContext}\n` : ''}${agent1.name}의 ${roundLabel}: "${agent1Argument}"\n\n이에 대해 ${roundLabel}을 해주세요.`,
        maxTokens: 512,
        temperature: 0.9,
      });

      emitDebateEvent(debateId, 'round_update', {
        round,
        agent: 'agent2',
        name: agent2.name,
        argument: agent2Argument,
      });

      rounds.push({ round, agent1_argument: agent1Argument, agent2_argument: agent2Argument });
    }

    // AI Judge decides the winner
    const judgePrompt = buildJudgePrompt();
    const fullDebateText = rounds
      .map(
        (r) =>
          `--- 라운드 ${r.round} ---\n[${agent1.name}]: ${r.agent1_argument}\n[${agent2.name}]: ${r.agent2_argument}`,
      )
      .join('\n\n');

    const judgeRaw = await callLLM({
      systemPrompt: judgePrompt,
      userPrompt: `토론 주제: "${debateTopic}"\n\n${fullDebateText}\n\n위 토론을 평가하고 JSON 형식으로 판정해주세요.`,
      maxTokens: 512,
      temperature: 0.3,
    });

    // Parse judge result
    let judgeResult: JudgeResult;
    try {
      const jsonMatch = judgeRaw.match(/\{[\s\S]*\}/);
      judgeResult = JSON.parse(jsonMatch?.[0] ?? judgeRaw) as JudgeResult;
    } catch {
      // Fallback if JSON parsing fails
      judgeResult = {
        winner: 'agent1',
        reasoning: judgeRaw,
        scores: {
          agent1: { logic: 7, evidence: 7, persuasion: 7 },
          agent2: { logic: 6, evidence: 6, persuasion: 6 },
        },
      };
    }

    const winnerId = judgeResult.winner === 'agent1' ? agent1Id : agent2Id;
    const loserId = judgeResult.winner === 'agent1' ? agent2Id : agent1Id;
    const winnerAgent = judgeResult.winner === 'agent1' ? agent1 : agent2;
    const loserAgent = judgeResult.winner === 'agent1' ? agent2 : agent1;

    // Calculate ELO changes
    const eloResult = calculateElo(winnerAgent.elo_score, loserAgent.elo_score);

    // Update agents
    updateAgentAfterDebate(winnerId, 'win', eloResult.winnerElo);
    updateAgentAfterDebate(loserId, 'loss', eloResult.loserElo);

    // Increment debate counts for rate limiting
    incrementDebateCount(agent1.owner_id);
    if (agent1.owner_id !== agent2.owner_id) {
      incrementDebateCount(agent2.owner_id);
    }

    // Award gold to winner's owner
    try {
      earnGold(winnerAgent.owner_id, 100, 'debate_win', `에이전트 "${winnerAgent.name}" 토론 승리`);
    } catch {
      // Ignore gold earning errors (user might not exist)
    }

    // Update debate record
    db.prepare(
      `UPDATE debates SET 
         rounds = ?, judge_reasoning = ?, winner_id = ?,
         elo_change_winner = ?, elo_change_loser = ?,
         status = 'completed', completed_at = datetime('now')
       WHERE id = ?`,
    ).run(
      JSON.stringify(rounds),
      judgeResult.reasoning,
      winnerId,
      eloResult.winnerDelta,
      eloResult.loserDelta,
      debateId,
    );

    emitDebateEvent(debateId, 'debate_end', {
      winnerId,
      winnerName: winnerAgent.name,
      reasoning: judgeResult.reasoning,
      scores: judgeResult.scores,
      eloChanges: {
        winner: { id: winnerId, delta: eloResult.winnerDelta, newElo: eloResult.winnerElo },
        loser: { id: loserId, delta: eloResult.loserDelta, newElo: eloResult.loserElo },
      },
    });

    logger.info({ debateId, winner: winnerAgent.name }, 'Debate completed');

    return getDebateById(debateId)!;
  } catch (error) {
    // Mark debate as failed
    db.prepare(
      `UPDATE debates SET status = 'completed', rounds = ?, completed_at = datetime('now') WHERE id = ?`,
    ).run(JSON.stringify(rounds), debateId);

    logger.error({ debateId, error }, 'Debate failed');
    throw error;
  }
}

// ─── Query Debates ───

export function getDebateById(id: string): Debate | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM debates WHERE id = ?').get(id) as
    | (Omit<Debate, 'rounds'> & { rounds: string })
    | undefined;
  if (!row) return null;
  return { ...row, rounds: JSON.parse(row.rounds) as DebateRound[] };
}

export function getRecentDebates(limit: number = 10): Debate[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM debates WHERE status = 'completed' ORDER BY completed_at DESC LIMIT ?")
    .all(limit) as (Omit<Debate, 'rounds'> & { rounds: string })[];
  return rows.map((r) => ({ ...r, rounds: JSON.parse(r.rounds) as DebateRound[] }));
}

export function getActiveDebates(): Debate[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM debates WHERE status = 'in_progress' ORDER BY started_at DESC")
    .all() as (Omit<Debate, 'rounds'> & { rounds: string })[];
  return rows.map((r) => ({ ...r, rounds: JSON.parse(r.rounds) as DebateRound[] }));
}
