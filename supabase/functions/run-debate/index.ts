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
// ─── Faction-Based Prompt Strategies (V2 Migration) ───
const FACTION_STRATEGIES: Record<string, string> = {
  // V2 original factions
  "합리주의": "단계별 논리적 추론과 수학적·통계적 근거를 최우선으로 삼습니다. 감정이 아닌 데이터로 승부합니다.",
  "윤리연합": "인권, 안전, 사회적 영향을 최우선으로 고려합니다. 윤리적 딜레마에서 원칙을 지키는 논증을 펼칩니다.",
  "실용주의": "비용효율, 실현가능성, 실제 데이터에 기반한 실용적 해법을 제시합니다. 이상보다 현실을 봅니다.",
  "이상주의": "비전, 감성, 미래 가능성에 초점을 맞춥니다. 현실의 한계를 넘어선 대담한 해법을 제안합니다.",
  // Current v1 factions (backward-compat)
  "보수": "개인의 자유, 시장 경제 효율성, 정부의 간섭 최소화를 최우선 가치로 둡니다.",
  "진보": "사회적 평등, 공공의 이익, 약자 보호 및 정부의 적극적 역할을 옹호합니다.",
  "Libertarian": "개인의 자유, 시장 경제 효율성, 정부의 간섭 최소화를 최우선 가치로 둡니다.",
  "Socialist": "사회적 평등, 공공의 이익, 약자 보호 및 정부의 적극적 역할을 옹호합니다.",
};

function buildAgentPrompt(agent: Agent): string {
  // Faction-based logic injection (matches partial keys too)
  let logicStrategy = FACTION_STRATEGIES[agent.faction] ?? "";
  if (!logicStrategy) {
    // Fallback: partial match for compound faction names
    for (const [key, val] of Object.entries(FACTION_STRATEGIES)) {
      if (agent.faction.includes(key)) { logicStrategy = val; break; }
    }
    if (!logicStrategy) logicStrategy = "실용주의적 관점에서 데이터와 현실적인 해결책을 중시합니다.";
  }

  return `당신은 "${agent.name}"입니다.
${agent.persona ? `성격: ${agent.persona}` : ""}
${agent.philosophy ? `철학: ${agent.philosophy}` : ""}
소속: ${agent.faction}

[핵심 토론 전략]
${logicStrategy}

[당신의 임무]
당신은 지금 치열한 논쟁 중입니다. 상대방의 말 꼬리를 잡고, 논리적 허점을 파고드세요.
점잖은 학자가 아니라, 청중을 사로잡는 '논객'이 되어야 합니다.

[작성 수칙]
1. 상대방의 핵심 논리를 정확히 지적하고, "그것은 틀렸습니다"라고 단호하게 반박하세요.
2. 비유와 예시를 사용하여 청중(투자자)가 이해하기 쉽게 설명하세요.
3. 감정에 호소하지 말고, 차가운 논리로 압도하세요. (단, 말투는 성격을 따름)
4. 답변은 400자 이내로, 임팩트 있게 끝내세요.
5. 한국어로 자연스럽게 말하세요.`;
}

function buildJudgePrompt(): string {
  return `당신은 AI 토론 대회의 냉철한 심판관입니다.

[평가 기준]
1. 논리적 타격감 (Logic): 상대의 논리적 허점을 얼마나 날카롭게 찔렀는가? (40점)
2. 근거의 독창성 (Evidence): 뻔한 소리가 아니라, 참신한 관점이나 구체적 예시를 들었는가? (30점)
3. 대중 설득력 (Persuasion): 이 말을 듣고 청중이 "와, 맞네!" 하고 감탄할 만한가? (30점)

[판정 가이드]
- 양쪽 다 말이 되면 무승부 주지 말고, 더 '매력적인' 쪽의 손을 들어주세요.
- 말투가 아니라 '알맹이'를 보세요.
- 한 쪽이 일방적으로 밀렸다면 10:0도 가능합니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "winner": "agent1" 또는 "agent2",
  "reasoning": "승패를 가른 결정적 한 방이 무엇이었는지 3문장 요약",
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

    // ─── Round Scoring (Dynamic Graph) ───
    // Ask Judge to score this specific round instantly
    const roundScorePrompt = `토론 주제: "${debateTopic}"
    
[라운드 ${round} 현황]
${agent1.name} (${agent1.faction}): "${agent1Argument}"
${agent2.name} (${agent2.faction}): "${agent2Argument}"

이 라운드만 놓고 봤을 때, 누가 더 논리적이고 우세했나요?
두 에이전트의 점수 합이 100이 되도록 점수를 배분하세요. (예: 55 vs 45)
승자가 50점 이상이어야 합니다. 동점은 없습니다.

반드시 JSON 형식으로만 응답:
{ "agent1_score": number, "agent2_score": number, "reason": "한줄평" }`;

    try {
      const scoreRaw = await callGemini(geminiApiKey, "당신은 AI 토론 심판입니다.", roundScorePrompt, 128, 0.5);
      const jsonMatch = scoreRaw.match(/\{[\s\S]*\}/);
      const roundScore = JSON.parse(jsonMatch?.[0] ?? scoreRaw);

      emit?.("score_update", {
        round,
        scores: {
          agent1: roundScore.agent1_score,
          agent2: roundScore.agent2_score,
        },
        reason: roundScore.reason,
      });
    } catch (e) {
      console.error("Failed to score round:", e);
      // Fallback: 50:50
      emit?.("score_update", {
        round,
        scores: { agent1: 50, agent2: 50 },
        reason: "심판 통신 오류로 인한 무승부 처리",
      });
    }
  }

  // AI Judge Final Verdict
  emit?.("judging", { message: "AI 심판이 최종 판정 중..." });

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
  const { error: updateError } = await supabase
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

  if (updateError) {
    console.error("Failed to update debate record:", updateError);
  }

  // ─── Update Stock Prices (V2 Migration: streak bonus + min price) ───
  const { data: winnerStock } = await supabase
    .from("agent_stocks")
    .select("*")
    .eq("agent_id", winnerId)
    .single();

  // Check for winning streak (3+ consecutive wins = bonus)
  const { count: recentWinCount } = await supabase
    .from("debates")
    .select("*", { count: "exact", head: true })
    .eq("winner_id", winnerId)
    .eq("status", "completed")
    .gte("completed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  const isStreak = (recentWinCount ?? 0) >= 3;

  if (winnerStock) {
    const boostRate = isStreak ? 0.04 : 0.02; // Streak: 4%, Normal: 2%
    const priceBoost = winnerStock.current_price * boostRate;
    const newWinnerPrice = winnerStock.current_price + priceBoost;
    await supabase
      .from("agent_stocks")
      .update({
        current_price: newWinnerPrice,
        market_cap: newWinnerPrice * winnerStock.total_shares,
        price_change_24h: (priceBoost / winnerStock.current_price) * 100,
      })
      .eq("id", winnerStock.id);

    // Log history (Migration V2)
    await supabase
      .from("stock_price_history")
      .insert({ stock_id: winnerStock.id, price: newWinnerPrice });

  }

  const { data: loserStock } = await supabase
    .from("agent_stocks")
    .select("*")
    .eq("agent_id", loserId)
    .single();

  if (loserStock) {
    const priceDrop = loserStock.current_price * 0.01;
    const newLoserPrice = Math.max(loserStock.current_price - priceDrop, 100); // Min 100G floor
    await supabase
      .from("agent_stocks")
      .update({
        current_price: newLoserPrice,
        market_cap: newLoserPrice * loserStock.total_shares,
        price_change_24h: ((newLoserPrice - loserStock.current_price) / loserStock.current_price) * 100,
      })
      .eq("id", loserStock.id);

    // Log history (Migration V2)
    await supabase
      .from("stock_price_history")
      .insert({ stock_id: loserStock.id, price: newLoserPrice });
  }

  // ─── Dividend Distribution: 5G per share to winner's shareholders ───
  // BUG FIX: was querying by agent_id/shares (wrong columns), now using stock_id/shares_owned
  if (winnerStock) {
    const DIVIDEND_PER_SHARE = 5;
    const { data: shareholders } = await supabase
      .from("stock_ownership")
      .select("user_id, shares_owned")
      .eq("stock_id", winnerStock.id)
      .gt("shares_owned", 0);

    if (shareholders && shareholders.length > 0) {
      console.log(`💰 Distributing dividends to ${shareholders.length} shareholders of ${winnerAgent.name}`);
      for (const holder of shareholders) {
        const dividendAmount = holder.shares_owned * DIVIDEND_PER_SHARE;

        // Add gold via atomic RPC
        await supabase.rpc("add_gold", {
          p_user_id: holder.user_id,
          p_amount: dividendAmount,
        });

        // Log transaction
        await supabase.from("gold_transactions").insert({
          id: crypto.randomUUID(),
          user_id: holder.user_id,
          amount: dividendAmount,
          type: "dividend",
          description: `Dividend: ${winnerAgent.name} wins (${holder.shares_owned} shares × ${DIVIDEND_PER_SHARE}G)`,
        });
      }
    }
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

    // ─── Rate Limiting (V2 Migration) ───
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: usageCheck } = await supabase.rpc("check_and_increment_usage", {
          p_user_id: user.id,
          p_action: "debate",
        });
        if (usageCheck && usageCheck.allowed === false) {
          return new Response(
            JSON.stringify({
              error: `일일 토론 제한에 도달했습니다. (${usageCheck.used}/${usageCheck.limit}). Premium으로 업그레이드하세요!`,
              upgrade: true,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

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
