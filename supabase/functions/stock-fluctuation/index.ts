/**
 * stock-fluctuation — Supabase Edge Function
 * =============================================
 * Applies random noise to all listed stock prices
 * to simulate natural market movement.
 *
 * Schedule via pg_cron every 5-10 minutes, or call manually.
 * Usage: supabase.functions.invoke('stock-fluctuation')
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

    // Fetch all stocks
    const { data: stocks, error: fetchError } = await supabase
      .from("agent_stocks")
      .select("id, current_price, price_change_24h");

    if (fetchError) throw new Error(fetchError.message);
    if (!stocks || stocks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No stocks to fluctuate." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const updates = [];

    for (const stock of stocks) {
      // Random noise: -0.5% to +0.5%
      const noisePct = (Math.random() - 0.5) * 1.0; // ±0.5%
      const priceChange = stock.current_price * (noisePct / 100);
      const newPrice = Math.max(10, Math.round(stock.current_price + priceChange)); // floor at 10G
      const newChange24h = parseFloat(
        ((stock.price_change_24h || 0) + noisePct).toFixed(2),
      );

      const { error: updateError } = await supabase
        .from("agent_stocks")
        .update({
          current_price: newPrice,
          price_change_24h: newChange24h,
          market_cap: newPrice * 1000, 
        })
        .eq("id", stock.id);

      if (!updateError) {
        // Log history (Migration V2)
        await supabase
          .from("stock_price_history")
          .insert({ stock_id: stock.id, price: newPrice });

        updates.push({
          id: stock.id,
          old_price: stock.current_price,
          new_price: newPrice,
          change_pct: noisePct.toFixed(3),
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `${updates.length} stocks fluctuated.`,
        updates,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Stock fluctuation error:", message);

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
