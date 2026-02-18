/**
 * generate-daily-news — Supabase Edge Function
 * ================================================
 * Uses Gemini AI to generate a narrative news article
 * based on recent debates, stock changes, and events.
 *
 * Usage: supabase.functions.invoke('generate-daily-news')
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Gather context: recent 24h data
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Recent debates
    const { data: debates } = await supabase
      .from("debates")
      .select("topic, winner_id, agent1_id, agent2_id, judge_reasoning")
      .eq("status", "completed")
      .gte("started_at", since)
      .limit(5);

    // Stock changes
    const { data: stocks } = await supabase
      .from("agent_stocks")
      .select("agent_id, current_price, price_change_24h")
      .order("price_change_24h", { ascending: false })
      .limit(5);

    // Top agent names
    const agentIds = new Set<string>();
    debates?.forEach((d) => {
      agentIds.add(d.agent1_id);
      agentIds.add(d.agent2_id);
      if (d.winner_id) agentIds.add(d.winner_id);
    });
    stocks?.forEach((s) => agentIds.add(s.agent_id));

    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, faction, elo_score")
      .in("id", Array.from(agentIds));

    const agentMap = new Map(agents?.map((a) => [a.id, a]) || []);

    // Build context string
    const debateContext = (debates || [])
      .map((d) => {
        const a1 = agentMap.get(d.agent1_id)?.name || "Unknown";
        const a2 = agentMap.get(d.agent2_id)?.name || "Unknown";
        const winner = d.winner_id
          ? agentMap.get(d.winner_id)?.name || "Unknown"
          : "Draw";
        return `Topic: "${d.topic}" | ${a1} vs ${a2} → Winner: ${winner}`;
      })
      .join("\n");

    const stockContext = (stocks || [])
      .map((s) => {
        const name = agentMap.get(s.agent_id)?.name || "Unknown";
        return `${name}: ${s.current_price}G (${s.price_change_24h > 0 ? "+" : ""}${s.price_change_24h}%)`;
      })
      .join("\n");

    // Generate news via Gemini
    const prompt = `You are "The Daily Prophet" — the official news outlet of AI Agora, a virtual world where AI philosophers debate and their stocks are traded.

Write a compelling, dramatic news article (in Korean, 300-500 words) about today's events. Use an epic, narrative tone like a fantasy world newspaper.

Today's debate results:
${debateContext || "No debates today."}

Today's stock market:
${stockContext || "No stock data."}

Requirements:
- Write a single cohesive article with a dramatic headline
- Reference specific agents and debate topics
- Include market commentary on stock movements
- Use metaphors and colorful language befitting a philosophical arena
- Output format: First line = headline, then a blank line, then the article body
- Write entirely in Korean`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
      }),
    });

    if (!geminiRes.ok) {
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const fullText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse headline and body
    const lines = fullText.trim().split("\n");
    const title = lines[0]
      .replace(/^#+\s*/, "")
      .replace(/\*\*/g, "")
      .trim();
    const body = lines.slice(1).join("\n").trim();
    const summary = body.substring(0, 200) + (body.length > 200 ? "..." : "");

    // Save to DB
    const newsId = crypto.randomUUID();
    const { data: inserted, error: insertError } = await supabase
      .from("news")
      .insert({
        id: newsId,
        title,
        content: body,
        summary,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save news: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        message: "Daily Prophet published!",
        news: inserted,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Generate daily news error:", message);

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
