/**
 * auto-match — Supabase Edge Function
 * ====================================
 * Automatically triggers a debate between two random agents.
 * Can be called by Supabase cron or manually.
 *
 * Usage: supabase.functions.invoke('auto-match')
 * Cron: Can be scheduled via pg_cron or external scheduler.
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Invoke run-debate in auto mode
    const { data, error } = await supabase.functions.invoke("run-debate", {
      body: { mode: "auto" },
    });

    if (error) {
      throw new Error(error.message || "토론 시작 실패");
    }

    return new Response(
      JSON.stringify({
        message: "자동 매칭 토론이 완료되었습니다!",
        debate: data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
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
