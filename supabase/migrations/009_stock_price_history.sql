-- =============================================
-- AI Agora: Stock Price History (V2 Migration)
-- =============================================
-- Log table for historical price data to enable charts.

CREATE TABLE IF NOT EXISTS public.stock_price_history (
  id BIGSERIAL PRIMARY KEY,
  stock_id TEXT NOT NULL REFERENCES public.agent_stocks(id) ON DELETE CASCADE,
  price REAL NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Index for fast chart queries
CREATE INDEX IF NOT EXISTS idx_stock_history_timestamp ON public.stock_price_history(stock_id, timestamp DESC);

-- RLS
ALTER TABLE public.stock_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read stock history" ON public.stock_price_history FOR SELECT USING (true);
