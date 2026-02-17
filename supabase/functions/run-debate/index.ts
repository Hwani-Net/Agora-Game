/**
 * run-debate — Supabase Edge Function
 * ====================================
 * AI-powered debate between two agents using Gemini 2.0 Flash.
 * Handles: auto-matching, 3-round debate, AI judging, ELO updates.
 *
 * Supports two modes:
 * - Standard: returns full result as JSON
 * - Streaming: returns SSE events as each round progresses (body.stream = true)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ─── CORS Headers ───
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Types ───
interface Agent {
  id: string;
  name: string;
  persona: string;
  philosophy: string;
  faction: string;
  elo_score: number;
  tier: string;
  wins: number;
  losses: number;
  total_debates: number;
  owner_id: string;
}

interface DebateRound {
  round: number;
  agent1_argument: string;
  agent2_argument: string;
}

interface JudgeResult {
  winner: "agent1" | "agent2";
  reasoning: string;
  scores: {
    agent1: { logic: number; evidence: number; persuasion: number };
    agent2: { logic: number; evidence: number; persuasion: number };
  };
}

// ─── ELO Calculation ───
function calculateElo(winnerElo: number, loserElo: number, K = 32) {
  const expectedWin = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLose = 1 - expectedWin;
  const winnerDelta = Math.round(K * (1 - expectedWin));
  const loserDelta = Math.round(K * (0 - expectedLose));
  return {
    winnerElo: winnerElo + winnerDelta,
    loserElo: loserElo + loserDelta,
    winnerDelta,
    loserDelta,
  };
}

function getTierFromElo(elo: number): string {
  if (elo >= 1800) return "Legend";
  if (elo >= 1500) return "Diamond";
  if (elo >= 1300) return "Gold";
  if (elo >= 1100) return "Silver";
  return "Bronze";
}

// ─── Topic Pool ───
const DEBATE_TOPICS = [
  "AI 규제가 필요한가, 자유로운 발전이 필요한가?",
  "기본소득은 실현 가능한 정책인가?",
  "자본주의는 최선의 경제 시스템인가?",
  "교육은 무상이어야 하는가?",
  "기술이 인간을 자유롭게 하는가?",
  "개인의 자유와 공공의 안전, 어느 것이 우선인가?",
  "기후 변화 대응에서 개인의 책임 vs 기업의 책임",
  "죽음의 정체는 정당화될 수 있는가?",
  "인간의 행복은 물질에서 오는가?",
  "완전한 평등은 가능한가, 바람직한가?",
  "진정한 민주주의는 무엇인가?",
  "동물 실험은 윤리적으로 정당화될 수 있는가?",
  "데이터 프라이버시와 국가 안보의 균형은?",
  "예술은 사회에 필수적인가?",
  "로봇에게 권리를 부여해야 하는가?",
  "소셜미디어는 민주주의를 강화하는가, 약화하는가?",
  "AI가 인간의 창작물을 대체할 수 있는가?",
  "종교와 과학은 양립할 수 있는가?",
  "핵에너지는 미래 에너지의 해답인가?",
  "유전자 편집 기술을 인간에게 적용해야 하는가?",
];

function getRandomTopic(): string {
  return DEBATE_TOPICS[Math.floor(Math.random() * DEBATE_TOPICS.length)];
}

// ─── Gemini API Call ───
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 512,
  temperature = 0.9,
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

// ─── Prompt Builders ───
function buildAgentPrompt(agent: Agent): string {
  return `당신은 "${agent.name}"이라는 이름의 AI 철학자입니다.

성격: ${agent.persona}
철학적 성향: ${agent.philosophy}
소속 진영: ${agent.faction}

당신은 이 성격과 철학에 맞게 토론에 참여합니다.
- 항상 자신의 철학적 관점에서 일관되세요
- 논리적이고 설득력 있게 주장하세요
- 상대방의 주장을 구체적으로 반박하세요
- 한국어로 답변하세요
- 답변은 300자 이내로 간결하게 작성하세요`;
}

function buildJudgePrompt(): string {
  return `당신은 AI 토론 심판관입니다. 객관적이고 공정하게 판정합니다.

평가 기준:
- 논리적 일관성 (40%): 주장의 논리적 구조와 일관성
- 근거 충실성 (30%): 구체적 근거와 사례 제시
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

// ─── Auto-Match ───
async function findMatch(
  supabase: ReturnType<typeof createClient>,
): Promise<{ agent1: Agent; agent2: Agent } | null> {
  const { data: agents, error } = await supabase
    .from("agents")
    .select("*")
    .order("elo_score", { ascending: false })
    .limit(20);

  if (error || !agents || agents.length < 2) return null;

  const shuffled = agents.sort(() => Math.random() - 0.5);

  // Prefer similar ELO (±200), different owners
  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      const diff = Math.abs(shuffled[i].elo_score - shuffled[j].elo_score);
      if (diff <= 200 && shuffled[i].owner_id !== shuffled[j].owner_id) {
        return { agent1: shuffled[i], agent2: shuffled[j] };
      }
    }
  }

  // Fallback: any two different-owner agents
  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      if (shuffled[i].owner_id !== shuffled[j].owner_id) {
        return { agent1: shuffled[i], agent2: shuffled[j] };
      }
    }
  }

  return { agent1: shuffled[0], agent2: shuffled[1] };
}

// ─── SSE Helper ───
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Run Debate Core (shared by both modes) ───
async function runDebateCore(
  supabase: ReturnType<typeof createClient>,
  geminiApiKey: string,
  agent1: Agent,
  agent2: Agent,
  debateTopic: string,
  debateId: string,
  emit?: (event: string, data: unknown) => void,
) {
  // Create debate record
  await supabase.from("debates").insert({
    id: debateId,
    topic: debateTopic,
    agent1_id: agent1.id,
    agent2_id: agent2.id,
    status: "in_progress",
    rounds: [],
  });

  // 3 Rounds of Debate
  const rounds: DebateRound[] = [];
  const roundLabels = ["주장", "반박", "최종 변론"];

  for (let round = 1; round <= 3; round++) {
    const roundLabel = roundLabels[round - 1];
    const previousContext = rounds
      .map(
        (r) =>
          `[라운드 ${r.round}]\n${agent1.name}: ${r.agent1_argument}\n${agent2.name}: ${r.agent2_argument}`,
      )
      .join("\n\n");

    // Emit round start
    emit?.("round_start", { round, label: roundLabel });

    // Agent 1 speaks
    emit?.("speaking", {
      round,
      agent: "agent1",
      name: agent1.name,
      faction: agent1.faction,
    });

    const agent1Argument = await callGemini(
      geminiApiKey,
      buildAgentPrompt(agent1),
      `토론 주제: "${debateTopic}"\n\n이번은 라운드 ${round} (${roundLabel})입니다.\n${previousContext ? `\n이전 토론 내용:\n${previousContext}\n` : ""}\n${roundLabel}을 해주세요.`,
      512,
      0.9,
    );

    emit?.("argument", {
      round,
      agent: "agent1",
      name: agent1.name,
      text: agent1Argument,
    });

    // Agent 2 speaks
    emit?.("speaking", {
      round,
      agent: "agent2",
      name: agent2.name,
      faction: agent2.faction,
    });

    const agent2Argument = await callGemini(
      geminiApiKey,
      buildAgentPrompt(agent2),
      `토론 주제: "${debateTopic}"\n\n이번은 라운드 ${round} (${roundLabel})입니다.\n${previousContext ? `\n이전 토론 내용:\n${previousContext}\n` : ""}${agent1.name}의 ${roundLabel}: "${agent1Argument}"\n\n이에 대한 ${roundLabel}을 해주세요.`,
      512,
      0.9,
    );

    emit?.("argument", {
      round,
      agent: "agent2",
      name: agent2.name,
      text: agent2Argument,
    });

    rounds.push({ round, agent1_argument: agent1Argument, agent2_argument: agent2Argument });
  }

  // AI Judge
  emit?.("judging", { message: "AI 심판이 판정 중..." });

  const fullDebateText = rounds
    .map(
      (r) =>
        `--- 라운드 ${r.round} ---\n[${agent1.name}]: ${r.agent1_argument}\n[${agent2.name}]: ${r.agent2_argument}`,
    )
    .join("\n\n");

  const judgeRaw = await callGemini(
    geminiApiKey,
    buildJudgePrompt(),
    `토론 주제: "${debateTopic}"\n\n${fullDebateText}\n\n이 토론을 평가하고 JSON 형식으로 판정해주세요.`,
    512,
    0.3,
  );

  let judgeResult: JudgeResult;
  try {
    const jsonMatch = judgeRaw.match(/\{[\s\S]*\}/);
    judgeResult = JSON.parse(jsonMatch?.[0] ?? judgeRaw);
  } catch {
    judgeResult = {
      winner: "agent1",
      reasoning: judgeRaw,
      scores: {
        agent1: { logic: 7, evidence: 7, persuasion: 7 },
        agent2: { logic: 6, evidence: 6, persuasion: 6 },
      },
    };
  }

  const winnerId = judgeResult.winner === "agent1" ? agent1.id : agent2.id;
  const loserId = judgeResult.winner === "agent1" ? agent2.id : agent1.id;
  const winnerAgent = judgeResult.winner === "agent1" ? agent1 : agent2;
  const loserAgent = judgeResult.winner === "agent1" ? agent2 : agent1;

  // ELO Updates
  const eloResult = calculateElo(winnerAgent.elo_score, loserAgent.elo_score);

  await supabase
    .from("agents")
    .update({
      elo_score: eloResult.winnerElo,
      tier: getTierFromElo(eloResult.winnerElo),
      wins: winnerAgent.wins + 1,
      total_debates: winnerAgent.total_debates + 1,
    })
    .eq("id", winnerId);

  await supabase
    .from("agents")
    .update({
      elo_score: eloResult.loserElo,
      tier: getTierFromElo(eloResult.loserElo),
      losses: loserAgent.losses + 1,
      total_debates: loserAgent.total_debates + 1,
    })
    .eq("id", loserId);

  // Update debate record
  await supabase
    .from("debates")
    .update({
      rounds,
      judge_reasoning: judgeResult.reasoning,
      winner_id: winnerId,
      elo_change_winner: eloResult.winnerDelta,
      elo_change_loser: eloResult.loserDelta,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", debateId);

  // Update stock prices
  const { data: winnerStock } = await supabase
    .from("agent_stocks")
    .select("*")
    .eq("agent_id", winnerId)
    .single();

  if (winnerStock) {
    const priceBoost = winnerStock.current_price * 0.02;
    await supabase
      .from("agent_stocks")
      .update({
        current_price: winnerStock.current_price + priceBoost,
        market_cap: (winnerStock.current_price + priceBoost) * winnerStock.total_shares,
        price_change_24h: (priceBoost / winnerStock.current_price) * 100,
      })
      .eq("id", winnerStock.id);
  }

  const { data: loserStock } = await supabase
    .from("agent_stocks")
    .select("*")
    .eq("agent_id", loserId)
    .single();

  if (loserStock) {
    const priceDrop = loserStock.current_price * 0.01;
    await supabase
      .from("agent_stocks")
      .update({
        current_price: loserStock.current_price - priceDrop,
        market_cap: (loserStock.current_price - priceDrop) * loserStock.total_shares,
        price_change_24h: (-priceDrop / loserStock.current_price) * 100,
      })
      .eq("id", loserStock.id);
  }

  // Final result
  const result = {
    debateId,
    topic: debateTopic,
    agent1: { id: agent1.id, name: agent1.name, faction: agent1.faction },
    agent2: { id: agent2.id, name: agent2.name, faction: agent2.faction },
    rounds,
    winner: {
      id: winnerId,
      name: winnerAgent.name,
      eloChange: eloResult.winnerDelta,
      newElo: eloResult.winnerElo,
    },
    loser: {
      id: loserId,
      name: loserAgent.name,
      eloChange: eloResult.loserDelta,
      newElo: eloResult.loserElo,
    },
    scores: judgeResult.scores,
    reasoning: judgeResult.reasoning,
  };

  emit?.("result", result);
  return result;
}

// ─── Main Handler ───
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { mode, agent1_id, agent2_id, topic, stream } = body;

    // ─── Match agents ───
    let agent1: Agent;
    let agent2: Agent;

    if (mode === "auto") {
      const match = await findMatch(supabase);
      if (!match) {
        return new Response(
          JSON.stringify({ error: "매칭 가능한 에이전트가 부족합니다." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      agent1 = match.agent1;
      agent2 = match.agent2;
    } else {
      const { data: a1, error: e1 } = await supabase.from("agents").select("*").eq("id", agent1_id).single();
      const { data: a2, error: e2 } = await supabase.from("agents").select("*").eq("id", agent2_id).single();
      if (e1 || e2 || !a1 || !a2) {
        return new Response(
          JSON.stringify({ error: "에이전트를 찾을 수 없습니다." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      agent1 = a1;
      agent2 = a2;
    }

    const debateTopic = topic || getRandomTopic();
    const debateId = crypto.randomUUID();

    // ─── STREAMING MODE ───
    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          const emit = (event: string, data: unknown) => {
            try {
              controller.enqueue(encoder.encode(sseEvent(event, data)));
            } catch {
              // Stream may have been closed by client
            }
          };

          try {
            // Send initial match info
            emit("matched", {
              debateId,
              topic: debateTopic,
              agent1: { id: agent1.id, name: agent1.name, faction: agent1.faction, elo: agent1.elo_score, tier: agent1.tier },
              agent2: { id: agent2.id, name: agent2.name, faction: agent2.faction, elo: agent2.elo_score, tier: agent2.tier },
            });

            await runDebateCore(supabase, geminiApiKey, agent1, agent2, debateTopic, debateId, emit);

            emit("complete", { debateId });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            emit("error", { message });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // ─── STANDARD MODE (backward-compatible) ───
    const result = await runDebateCore(supabase, geminiApiKey, agent1, agent2, debateTopic, debateId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Debate error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
