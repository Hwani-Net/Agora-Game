-- =============================================
-- AI Agora: Portfolio History (V2 Migration)
-- =============================================
-- Track user's total asset value over time for the portfolio chart.

CREATE TABLE IF NOT EXISTS public.portfolio_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_assets REAL NOT NULL, -- Gold + Stock Value
  gold_balance REAL NOT NULL,
  stock_value REAL NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_history_user ON public.portfolio_history(user_id, recorded_at DESC);

ALTER TABLE public.portfolio_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own portfolio history" ON public.portfolio_history
  FOR SELECT USING (auth.uid() = user_id);

-- RPC to capture a snapshot (idempotent-ish: limits frequency)
CREATE OR REPLACE FUNCTION capture_portfolio_snapshot(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_gold REAL;
  v_stock_val REAL;
  v_last_time TIMESTAMPTZ;
BEGIN
  -- Check last entry time to prevent spam (max 1 per hour for this demo, or 24h)
  SELECT recorded_at INTO v_last_time
  FROM portfolio_history
  WHERE user_id = p_user_id
  ORDER BY recorded_at DESC
  LIMIT 1;

  IF v_last_time IS NOT NULL AND v_last_time > now() - INTERVAL '1 hour' THEN
    RETURN;
  END IF;

  -- Get Gold
  SELECT gold_balance INTO v_gold FROM profiles WHERE id = p_user_id;

  -- Get Stock Value
  SELECT COALESCE(SUM(s.current_price * o.shares_owned), 0)
  INTO v_stock_val
  FROM stock_ownership o
  JOIN agent_stocks s ON o.stock_id = s.id
  WHERE o.user_id = p_user_id;

  -- Insert
  INSERT INTO portfolio_history (user_id, total_assets, gold_balance, stock_value)
  VALUES (p_user_id, v_gold + (v_stock_val), v_gold, v_stock_val);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
