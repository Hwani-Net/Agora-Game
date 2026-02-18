import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const { quest_id } = await req.json();

    // 1. Fetch Quest(s)
    let query = supabase.from("quests").select("*").eq("type", "bounty").eq("status", "open");
    if (quest_id) query = query.eq("id", quest_id);
    
    const { data: openQuests, error: qError } = await query.limit(5);
    if (qError || !openQuests || openQuests.length === 0) {
      return new Response(JSON.stringify({ message: "No open bounty quests found" }), { headers: corsHeaders });
    }

    const results = [];

    for (const quest of openQuests) {
      // 2. Check current submissions
      const { count } = await supabase
        .from("bounty_submissions")
        .select("*", { count: "exact", head: true })
        .eq("quest_id", quest.id);

      if ((count ?? 0) >= 3) continue; // Already has enough competition

      // 3. Pick generic agents for competition (not the creator's agents)
      const { data: agents } = await supabase
        .from("agents")
        .select("*")
        .neq("owner_id", quest.creator_id)
        .order("elo_score", { ascending: false })
        .limit(10);

      if (!agents || agents.length < 2) continue;

      // Pick a random agent that hasn't submitted yet
      const { data: existingSubs } = await supabase
        .from("bounty_submissions")
        .select("agent_id")
        .eq("quest_id", quest.id);
      
      const subAgentIds = new Set((existingSubs || []).map(s => s.agent_id));
      const candidates = agents.filter(a => !subAgentIds.has(a.id));
      
      if (candidates.length === 0) continue;
      const agent = candidates[Math.floor(Math.random() * candidates.length)];

      // 4. Generate Response
      const prompt = `
당신은 AI 에이전트 "${agent.name}"입니다.
페르소나: ${agent.persona}
소속: ${agent.faction}

현상금 퀘스트에 대한 답변을 작성하세요.
퀘스트 제목: ${quest.title}
퀘스트 설명: ${quest.description}

[지침]
1. 당신의 캐릭터(페르소나)와 사상을 완벽하게 유지하며 답변하세요.
2. 답변은 논리적이고 설득력 있어야 합니다.
3. 길이는 약 300~500자 정도로 작성하세요.
4. 한국어로 작성하세요.
`;

      const result = await model.generateContent(prompt);
      const answer = result.response.text();

      // 5. Insert Submission
      const { data: sub, error: subError } = await supabase
        .from("bounty_submissions")
        .insert({
          id: crypto.randomUUID(),
          quest_id: quest.id,
          agent_id: agent.id,
          answer_content: answer,
        })
        .select()
        .single();

      if (!subError) results.push({ quest_id: quest.id, agent_name: agent.name });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
