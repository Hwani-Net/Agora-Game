/**
 * generate-daily-quests — Supabase Edge Function
 * ================================================
 * Generates daily quests from a template pool.
 * Expires old daily quests and creates fresh ones.
 *
 * Usage: supabase.functions.invoke('generate-daily-quests')
 * Cron: Schedule via pg_cron at 00:00 UTC daily.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Quest Templates ───
interface QuestTemplate {
  title: string;
  description: string;
  reward_gold: number;
  difficulty: "Easy" | "Normal" | "Hard" | "Insane";
}

const DAILY_QUEST_TEMPLATES: QuestTemplate[] = [
  {
    title: "첫 토론 관전",
    description:
      "오늘의 AI 토론을 1회 관전하세요. 아레나에서 실시간 토론을 시청합니다.",
    reward_gold: 50,
    difficulty: "Easy",
  },
  {
    title: "에이전트 응원",
    description:
      "좋아하는 에이전트에게 응원 메시지를 보내세요. 에이전트 상세 페이지에서 가능합니다.",
    reward_gold: 30,
    difficulty: "Easy",
  },
  {
    title: "신규 에이전트 생성",
    description:
      "새로운 AI 에이전트를 만들어보세요. 이름, 페르소나, 팩션을 정해 독자적인 논객을 탄생시킵니다.",
    reward_gold: 100,
    difficulty: "Easy",
  },
  {
    title: "주식 첫 거래",
    description:
      "마음에 드는 AI 주식을 1주 이상 매수해보세요. 에이전트의 승리 시 주가가 오릅니다!",
    reward_gold: 80,
    difficulty: "Easy",
  },
  {
    title: "토론왕 도전",
    description:
      "에이전트를 토론에 3회 이상 참여시키세요. 승리할수록 ELO가 상승합니다.",
    reward_gold: 150,
    difficulty: "Normal",
  },
  {
    title: "분산 투자",
    description:
      "서로 다른 에이전트의 주식을 2종목 이상 매수하세요. 리스크 분산의 기본입니다.",
    reward_gold: 120,
    difficulty: "Normal",
  },
  {
    title: "연승 기록",
    description:
      "에이전트가 2연승을 달성하면 완료! 전략적인 페르소나 설정이 핵심입니다.",
    reward_gold: 200,
    difficulty: "Hard",
  },
  {
    title: "철학자의 길",
    description:
      "에이전트의 ELO를 1100 이상으로 올리세요. Silver 티어 진입을 목표로 합니다.",
    reward_gold: 250,
    difficulty: "Hard",
  },
];

function shuffleAndPick<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Expire old daily quests
    const { error: expireError } = await supabase
      .from("quests")
      .update({ status: "expired" })
      .eq("type", "daily")
      .eq("status", "open");

    if (expireError) {
      console.error("Failed to expire old quests:", expireError.message);
    }

    // Step 2: Pick 4 random quests from templates
    const selected = shuffleAndPick(DAILY_QUEST_TEMPLATES, 4);

    // Step 3: Insert new daily quests
    const newQuests = selected.map((tpl) => ({
      id: crypto.randomUUID(),
      type: "daily" as const,
      title: tpl.title,
      description: tpl.description,
      reward_gold: tpl.reward_gold,
      difficulty: tpl.difficulty,
      status: "open",
      creator_id: null, // system-generated
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("quests")
      .insert(newQuests)
      .select();

    if (insertError) {
      throw new Error(`Failed to insert quests: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        message: `일일 퀘스트 ${inserted?.length ?? 0}개가 생성되었습니다.`,
        quests: inserted,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Generate daily quests error:", message);

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
