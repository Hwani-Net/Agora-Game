/**
 * auto-match — Supabase Edge Function
 * ====================================
 * Automatically picks two random agents and invokes run-debate.
 * Uses fetch with SUPABASE_ANON_KEY (default env provided by Supabase).
 */

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use dynamic import for supabase-js
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2.49.4"
    );
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if there's already a debate in progress
    const { data: activeDebates } = await supabase
      .from("debates")
      .select("id")
      .eq("status", "in_progress")
      .limit(1);

    if (activeDebates && activeDebates.length > 0) {
      return new Response(
        JSON.stringify({
          message: "이미 진행 중인 토론이 있습니다.",
          debate_id: activeDebates[0].id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call run-debate with proper Supabase headers
    const runDebateUrl = `${supabaseUrl}/functions/v1/run-debate`;
    const response = await fetch(runDebateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ mode: "auto" }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`run-debate failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        message: "자동 매칭 토론이 완료되었습니다!",
        debate: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Auto-match error:", message);

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
