-- =============================================
-- execute_trade — Atomic stock trading function
-- =============================================
-- Handles both buy and sell operations in a single transaction.
-- All validations and 5-table updates happen atomically.

CREATE OR REPLACE FUNCTION public.execute_trade(
  p_user_id UUID,
  p_stock_id TEXT,
  p_action TEXT,   -- 'buy' or 'sell'
  p_shares INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- Validate action
  IF p_action NOT IN ('buy', 'sell') THEN
    RETURN jsonb_build_object('error', 'Invalid action. Use buy or sell.');
  END IF;

  -- Validate shares
  IF p_shares <= 0 OR p_shares > 1000 THEN
    RETURN jsonb_build_object('error', 'Invalid shares amount (1~1000).');
  END IF;

  -- Lock and fetch stock
  SELECT * INTO v_stock
  FROM public.agent_stocks
  WHERE id = p_stock_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Stock not found.');
  END IF;

  -- Lock and fetch user profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found.');
  END IF;

  -- Fetch current ownership (may not exist)
  SELECT * INTO v_ownership
  FROM public.stock_ownership
  WHERE user_id = p_user_id AND stock_id = p_stock_id
  FOR UPDATE;

  v_total_amount := v_stock.current_price * p_shares;
  v_txn_id := gen_random_uuid()::text;
  v_gold_txn_id := gen_random_uuid()::text;

  -- ─── BUY ───
  IF p_action = 'buy' THEN
    -- Check available shares
    IF p_shares > v_stock.available_shares THEN
      RETURN jsonb_build_object('error', '잔여 주식이 부족합니다. (남은 주식: ' || v_stock.available_shares || ')');
    END IF;

    -- Check gold balance
    IF v_total_amount > v_profile.gold_balance THEN
      RETURN jsonb_build_object('error', '골드가 부족합니다. (필요: ' || ROUND(v_total_amount) || 'G, 보유: ' || v_profile.gold_balance || 'G)');
    END IF;

    v_new_gold := v_profile.gold_balance - ROUND(v_total_amount)::integer;

    -- Update gold balance
    UPDATE public.profiles
    SET gold_balance = v_new_gold, updated_at = now()
    WHERE id = p_user_id;

    -- Decrease available shares
    UPDATE public.agent_stocks
    SET available_shares = available_shares - p_shares
    WHERE id = p_stock_id;

    -- Upsert ownership
    IF v_ownership IS NULL OR v_ownership.shares_owned IS NULL THEN
      INSERT INTO public.stock_ownership (id, user_id, stock_id, shares_owned, avg_buy_price)
      VALUES (gen_random_uuid()::text, p_user_id, p_stock_id, p_shares, v_stock.current_price);
      v_new_shares := p_shares;
      v_new_avg_price := v_stock.current_price;
    ELSE
      v_new_avg_price := (
        (v_ownership.avg_buy_price * v_ownership.shares_owned) + (v_stock.current_price * p_shares)
      ) / (v_ownership.shares_owned + p_shares);
      v_new_shares := v_ownership.shares_owned + p_shares;

      UPDATE public.stock_ownership
      SET shares_owned = v_new_shares, avg_buy_price = v_new_avg_price
      WHERE user_id = p_user_id AND stock_id = p_stock_id;
    END IF;

    -- Record stock transaction
    INSERT INTO public.stock_transactions (id, user_id, stock_id, type, shares, price, total_amount)
    VALUES (v_txn_id, p_user_id, p_stock_id, 'buy', p_shares, v_stock.current_price, v_total_amount);

    -- Record gold transaction
    INSERT INTO public.gold_transactions (id, user_id, amount, type, description)
    VALUES (v_gold_txn_id, p_user_id, -ROUND(v_total_amount)::integer, 'stock_buy',
      '주식 매수: ' || p_shares || '주 @ ' || ROUND(v_stock.current_price) || 'G');

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

  -- ─── SELL ───
  ELSIF p_action = 'sell' THEN
    -- Check ownership
    IF v_ownership IS NULL OR v_ownership.shares_owned < p_shares THEN
      RETURN jsonb_build_object('error', '보유 주식이 부족합니다. (보유: ' ||
        COALESCE(v_ownership.shares_owned, 0) || '주)');
    END IF;

    v_new_gold := v_profile.gold_balance + ROUND(v_total_amount)::integer;
    v_new_shares := v_ownership.shares_owned - p_shares;

    -- Update gold balance
    UPDATE public.profiles
    SET gold_balance = v_new_gold, updated_at = now()
    WHERE id = p_user_id;

    -- Increase available shares
    UPDATE public.agent_stocks
    SET available_shares = available_shares + p_shares
    WHERE id = p_stock_id;

    -- Update or delete ownership
    IF v_new_shares = 0 THEN
      DELETE FROM public.stock_ownership
      WHERE user_id = p_user_id AND stock_id = p_stock_id;
    ELSE
      UPDATE public.stock_ownership
      SET shares_owned = v_new_shares
      WHERE user_id = p_user_id AND stock_id = p_stock_id;
    END IF;

    -- Record stock transaction
    INSERT INTO public.stock_transactions (id, user_id, stock_id, type, shares, price, total_amount)
    VALUES (v_txn_id, p_user_id, p_stock_id, 'sell', p_shares, v_stock.current_price, v_total_amount);

    -- Record gold transaction
    INSERT INTO public.gold_transactions (id, user_id, amount, type, description)
    VALUES (v_gold_txn_id, p_user_id, ROUND(v_total_amount)::integer, 'stock_sell',
      '주식 매도: ' || p_shares || '주 @ ' || ROUND(v_stock.current_price) || 'G');

    RETURN jsonb_build_object(
      'success', true,
      'action', 'sell',
      'shares', p_shares,
      'price', v_stock.current_price,
      'total_revenue', ROUND(v_total_amount),
      'new_gold_balance', v_new_gold,
      'shares_owned', v_new_shares,
      'profit', ROUND((v_stock.current_price - v_ownership.avg_buy_price) * p_shares)
    );
  END IF;
END;
$$;
