// trade-stock Edge Function — Buy/Sell stocks atomically
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request body
    const { action, stock_id, shares } = await req.json();

    if (!action || !stock_id || !shares) {
      return new Response(
        JSON.stringify({ error: 'action, stock_id, shares are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!['buy', 'sell'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'action must be "buy" or "sell".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sharesNum = parseInt(shares, 10);
    if (isNaN(sharesNum) || sharesNum <= 0 || sharesNum > 1000) {
      return new Response(
        JSON.stringify({ error: '거래 수량은 1~1000 사이여야 합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use user's JWT to verify identity
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Use service role client to call the DB function (SECURITY DEFINER)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await serviceClient.rpc('execute_trade', {
      p_user_id: user.id,
      p_stock_id: stock_id,
      p_action: action,
      p_shares: sharesNum,
    });

    if (error) {
      console.error('RPC error:', error);
      return new Response(
        JSON.stringify({ error: error.message || '거래 처리 중 오류가 발생했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if the DB function returned an error
    if (data?.error) {
      return new Response(
        JSON.stringify({ error: data.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Trade error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
