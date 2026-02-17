-- execute_trade.sql
-- Function to execute stock trades atomically
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.execute_trade(
  p_user_id UUID,
  p_stock_id TEXT,
  p_action TEXT,
  p_shares INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock RECORD;
  v_profile RECORD;
  v_ownership RECORD;
  v_total_amount REAL;
  v_new_gold INTEGER;
  v_new_shares INTEGER;
  v_new_avg_price REAL;
  v_txn_id TEXT;
  v_gold_txn_id TEXT;
BEGIN
  -- Validate inputs
  IF p_action NOT IN ('buy', 'sell') THEN
    RETURN jsonb_build_object('error', 'Invalid action. Use buy or sell.');
  END IF;

  IF p_shares <= 0 OR p_shares > 1000 THEN
    RETURN jsonb_build_object('error', 'Invalid shares amount (1~1000).');
  END IF;

  -- Lock stock row
  SELECT * INTO v_stock FROM public.agent_stocks WHERE id = p_stock_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Stock not found.');
  END IF;

  -- Lock user profile row
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found.');
  END IF;

  -- Lock ownership row (if exists)
  SELECT * INTO v_ownership FROM public.stock_ownership WHERE user_id = p_user_id AND stock_id = p_stock_id FOR UPDATE;

  -- Calculate total amount
  v_total_amount := v_stock.current_price * p_shares;
  
  -- Generate IDs
  v_txn_id := gen_random_uuid()::text;
  v_gold_txn_id := gen_random_uuid()::text;

  -- BUY Logic
  IF p_action = 'buy' THEN
    -- Check stock availability
    IF p_shares > v_stock.available_shares THEN
      RETURN jsonb_build_object('error', 'Not enough available shares. (Left: ' || v_stock.available_shares || ')');
    END IF;

    -- Check gold balance
    IF v_total_amount > v_profile.gold_balance THEN
      RETURN jsonb_build_object('error', 'Not enough gold. (Need: ' || ROUND(v_total_amount) || 'G, Have: ' || v_profile.gold_balance || 'G)');
    END IF;

    -- Deduct gold
    v_new_gold := v_profile.gold_balance - ROUND(v_total_amount)::integer;
    UPDATE public.profiles SET gold_balance = v_new_gold, updated_at = now() WHERE id = p_user_id;

    -- Deduct shares from market
    UPDATE public.agent_stocks SET available_shares = available_shares - p_shares WHERE id = p_stock_id;

    -- Update ownership
    IF v_ownership IS NULL OR v_ownership.shares_owned IS NULL THEN
      INSERT INTO public.stock_ownership (id, user_id, stock_id, shares_owned, avg_buy_price)
      VALUES (gen_random_uuid()::text, p_user_id, p_stock_id, p_shares, v_stock.current_price);
      v_new_shares := p_shares;
      v_new_avg_price := v_stock.current_price;
    ELSE
      -- Calculate new average price: ((old_avg * old_shares) + (new_price * new_shares)) / total_shares
      v_new_avg_price := ((v_ownership.avg_buy_price * v_ownership.shares_owned) + (v_stock.current_price * p_shares)) / (v_ownership.shares_owned + p_shares);
      v_new_shares := v_ownership.shares_owned + p_shares;
      UPDATE public.stock_ownership 
      SET shares_owned = v_new_shares, avg_buy_price = v_new_avg_price 
      WHERE user_id = p_user_id AND stock_id = p_stock_id;
    END IF;

    -- Log transaction
    INSERT INTO public.stock_transactions (id, user_id, stock_id, type, shares, price, total_amount)
    VALUES (v_txn_id, p_user_id, p_stock_id, 'buy', p_shares, v_stock.current_price, v_total_amount);

    -- Log gold transaction
    INSERT INTO public.gold_transactions (id, user_id, amount, type, description)
    VALUES (v_gold_txn_id, p_user_id, -ROUND(v_total_amount)::integer, 'stock_buy', 'Stock buy: ' || p_shares || ' shares');

    RETURN jsonb_build_object(
      'success', true,
      'action', 'buy',
      'shares', p_shares,
      'price', v_stock.current_price,
      'total_cost', ROUND(v_total_amount),
      'new_gold_balance', v_new_gold,
      'shares_owned', v_new_shares,
      'avg_buy_price', ROUND(v_new_avg_price::numeric, 1)
    );

  -- SELL Logic
  ELSIF p_action = 'sell' THEN
    -- Check ownership
    IF v_ownership IS NULL OR v_ownership.shares_owned < p_shares THEN
      RETURN jsonb_build_object('error', 'Not enough shares owned.');
    END IF;

    -- Add gold
    v_new_gold := v_profile.gold_balance + ROUND(v_total_amount)::integer;
    v_new_shares := v_ownership.shares_owned - p_shares;
    
    UPDATE public.profiles SET gold_balance = v_new_gold, updated_at = now() WHERE id = p_user_id;

    -- Return shares to market
    UPDATE public.agent_stocks SET available_shares = available_shares + p_shares WHERE id = p_stock_id;

    -- Update ownership
    IF v_new_shares = 0 THEN
      DELETE FROM public.stock_ownership WHERE user_id = p_user_id AND stock_id = p_stock_id;
    ELSE
      UPDATE public.stock_ownership SET shares_owned = v_new_shares WHERE user_id = p_user_id AND stock_id = p_stock_id;
    END IF;

    -- Log transaction
    INSERT INTO public.stock_transactions (id, user_id, stock_id, type, shares, price, total_amount)
    VALUES (v_txn_id, p_user_id, p_stock_id, 'sell', p_shares, v_stock.current_price, v_total_amount);

    -- Log gold transaction
    INSERT INTO public.gold_transactions (id, user_id, amount, type, description)
    VALUES (v_gold_txn_id, p_user_id, ROUND(v_total_amount)::integer, 'stock_sell', 'Stock sell: ' || p_shares || ' shares');

    RETURN jsonb_build_object(
      'success', true,
      'action', 'sell',
      'shares', p_shares,
      'price', v_stock.current_price,
      'total_revenue', ROUND(v_total_amount),
      'new_gold_balance', v_new_gold, 'shares_owned', v_new_shares, 'profit', ROUND((v_stock.current_price - v_ownership.avg_buy_price) * p_shares));
  END IF;
END;
$$;

-- IMPORTANT: Grant permission for service_role to execute this function
GRANT EXECUTE ON FUNCTION public.execute_trade(uuid, text, text, integer) TO service_role;
