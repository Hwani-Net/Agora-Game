/**
 * llm.ts — Gemini Flash LLM Wrapper
 * ====================================
 * Centralized AI call layer for agent debates, judging, and news generation.
 * Uses @google/generative-ai (Gemini 2.0 Flash).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

// ─── Core LLM Call ───

export interface LLMCallOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export async function callLLM(options: LLMCallOptions): Promise<string> {
  const { systemPrompt, userPrompt, maxTokens = 1024, temperature = 0.8 } = options;

  try {
    const model = getGenAI().getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    });

    const result = await model.generateContent(userPrompt);
    const text = result.response.text();
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'LLM call failed');
    throw new Error(`AI 호출 실패: ${message}`);
  }
}

// ─── Agent Debate Prompt ───

export function buildAgentDebatePrompt(
  agentName: string,
  persona: string,
  philosophy: string,
  faction: string,
): string {
  return `당신은 "${agentName}"이라는 이름의 AI 철학자입니다.

성격: ${persona}
철학적 성향: ${philosophy}
소속 진영: ${faction}

당신은 이 성격과 철학에 맞게 토론에 참여합니다.
- 항상 자신의 철학적 관점에서 논증하세요
- 논리적이고 설득력 있게 주장하세요
- 상대방의 주장에 구체적으로 반론하세요
- 한국어로 답변하세요
- 답변은 300자 이내로 간결하게 작성하세요`;
}

// ─── AI Judge Prompt ───

export function buildJudgePrompt(): string {
  return `당신은 AI 토론 심판관입니다. 엄격하고 공정하게 판정합니다.

평가 기준:
- 논리적 일관성 (40%): 주장의 논리적 구조와 일관성
- 근거 충실도 (30%): 구체적 근거와 사례 제시
- 설득력 (30%): 전체적인 설득 효과

반드시 아래 JSON 형식으로만 답변하세요:
{
  "winner": "agent1" 또는 "agent2",
  "reasoning": "판정 이유를 3-4문장으로 설명",
  "scores": {
    "agent1": { "logic": 0-10, "evidence": 0-10, "persuasion": 0-10 },
    "agent2": { "logic": 0-10, "evidence": 0-10, "persuasion": 0-10 }
  }
}`;
}

// ─── Daily Prophet Prompt ───

export function buildProphetPrompt(): string {
  return `당신은 "AI 아고라"라는 가상 세계의 뉴스 앵커입니다.
오늘 발생한 토론 결과, 주가 변동, 이벤트 등을 바탕으로 
서사적이고 몰입감 있는 뉴스 기사를 작성합니다.

문체 예시: "오늘 아고라 광장에서 벌어진 대격돌에서..."
- 흥미진진한 서사 톤을 유지하세요
- 실제 토론 결과와 주가 데이터를 인용하세요
- 한국어로 작성하세요
- 500자 이내로 작성하세요`;
}

// ─── Quest Generation Prompt ───

export function buildQuestPrompt(): string {
  return `당신은 AI 아고라 퀘스트 마스터입니다.
사용자의 AI 에이전트들이 도전할 흥미로운 철학/시사 퀘스트를 생성합니다.

아래 JSON 형식으로만 답변하세요:
{
  "title": "퀘스트 제목",
  "description": "퀘스트 설명 (100자 이내)",
  "difficulty": "Easy" 또는 "Normal" 또는 "Hard" 또는 "Insane"
}`;
}
