-- =============================================
-- AI Agora — Supabase PostgreSQL Schema
-- =============================================
-- SQLite → PostgreSQL 변환. Supabase Dashboard > SQL Editor에서 실행.

-- ─── Users ───
-- Supabase Auth와 연동. auth.users의 id를 참조.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT DEFAULT '',
  gold_balance INTEGER DEFAULT 1000,
  is_premium BOOLEAN DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── AI Agents ───
CREATE TABLE IF NOT EXISTS public.agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  persona TEXT NOT NULL,
  philosophy TEXT NOT NULL,
  faction TEXT NOT NULL,
  elo_score INTEGER DEFAULT 1000,
  tier TEXT DEFAULT 'Bronze',
  total_debates INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Debates ───
CREATE TABLE IF NOT EXISTS public.debates (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  agent1_id TEXT NOT NULL REFERENCES public.agents(id),
  agent2_id TEXT NOT NULL REFERENCES public.agents(id),
  rounds JSONB DEFAULT '[]'::jsonb,
  judge_reasoning TEXT DEFAULT '',
  winner_id TEXT,
  elo_change_winner INTEGER DEFAULT 0,
  elo_change_loser INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─── Agent Stocks ───
CREATE TABLE IF NOT EXISTS public.agent_stocks (
  id TEXT PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL REFERENCES public.agents(id),
  current_price REAL DEFAULT 1000.0,
  total_shares INTEGER DEFAULT 1000,
  available_shares INTEGER DEFAULT 1000,
  market_cap REAL DEFAULT 1000000.0,
  price_change_24h REAL DEFAULT 0.0,
  dividend_per_win INTEGER DEFAULT 10,
  ipo_date TIMESTAMPTZ DEFAULT now()
);

-- ─── Stock Ownership ───
CREATE TABLE IF NOT EXISTS public.stock_ownership (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  stock_id TEXT NOT NULL REFERENCES public.agent_stocks(id),
  shares_owned INTEGER DEFAULT 0,
  avg_buy_price REAL DEFAULT 0.0,
  UNIQUE(user_id, stock_id)
);

-- ─── Stock Transactions ───
CREATE TABLE IF NOT EXISTS public.stock_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  stock_id TEXT NOT NULL REFERENCES public.agent_stocks(id),
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  shares INTEGER NOT NULL,
  price REAL NOT NULL,
  total_amount REAL NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- ─── Quests ───
CREATE TABLE IF NOT EXISTS public.quests (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('daily', 'bounty')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_gold INTEGER DEFAULT 100,
  difficulty TEXT DEFAULT 'Normal' CHECK (difficulty IN ('Easy', 'Normal', 'Hard', 'Insane')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'expired')),
  creator_id UUID REFERENCES public.profiles(id),
  solver_agent_id TEXT REFERENCES public.agents(id),
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Bounty Submissions ───
CREATE TABLE IF NOT EXISTS public.bounty_submissions (
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL REFERENCES public.quests(id),
  agent_id TEXT NOT NULL REFERENCES public.agents(id),
  answer_content TEXT NOT NULL,
  votes INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Events ───
CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ai', 'community', 'admin')),
  effects JSONB DEFAULT '{}'::jsonb,
  intensity TEXT DEFAULT 'medium' CHECK (intensity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- ─── Polls ───
CREATE TABLE IF NOT EXISTS public.polls (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  votes_per_option JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_voters INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Poll Votes ───
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES public.polls(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  option_index INTEGER NOT NULL,
  voted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- ─── Usage Tracking ───
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id),
  debates_today INTEGER DEFAULT 0,
  trades_today INTEGER DEFAULT 0,
  last_debate_date DATE DEFAULT CURRENT_DATE,
  last_trade_date DATE DEFAULT CURRENT_DATE
);

-- ─── Gold Transactions ───
CREATE TABLE IF NOT EXISTS public.gold_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_agents_owner ON public.agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_elo ON public.agents(elo_score DESC);
CREATE INDEX IF NOT EXISTS idx_debates_status ON public.debates(status);
CREATE INDEX IF NOT EXISTS idx_stock_agent ON public.agent_stocks(agent_id);
CREATE INDEX IF NOT EXISTS idx_quests_type ON public.quests(type, status);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: 누구나 읽기, 본인만 수정
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Agents: 누구나 읽기, 로그인 사용자가 생성, 소유자만 수정
CREATE POLICY "agents_select" ON public.agents FOR SELECT USING (true);
CREATE POLICY "agents_insert" ON public.agents FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "agents_update" ON public.agents FOR UPDATE USING (auth.uid() = owner_id);

-- Debates: 누구나 읽기, 서비스 키로만 생성/수정 (Edge Function)
CREATE POLICY "debates_select" ON public.debates FOR SELECT USING (true);
CREATE POLICY "debates_service_insert" ON public.debates FOR INSERT WITH CHECK (true);
CREATE POLICY "debates_service_update" ON public.debates FOR UPDATE USING (true);

-- Stocks: 누구나 읽기, 서비스 키로만 수정
CREATE POLICY "stocks_select" ON public.agent_stocks FOR SELECT USING (true);
CREATE POLICY "stocks_service_all" ON public.agent_stocks FOR ALL USING (true);

-- Stock Ownership: 본인 것만 읽기/쓰기
CREATE POLICY "ownership_select" ON public.stock_ownership FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ownership_insert" ON public.stock_ownership FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ownership_update" ON public.stock_ownership FOR UPDATE USING (auth.uid() = user_id);

-- Stock Transactions: 본인 것만 읽기, 로그인시 생성
CREATE POLICY "txn_select" ON public.stock_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "txn_insert" ON public.stock_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Quests: 누구나 읽기, 로그인시 생성
CREATE POLICY "quests_select" ON public.quests FOR SELECT USING (true);
CREATE POLICY "quests_insert" ON public.quests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "quests_update" ON public.quests FOR UPDATE USING (true);

-- Bounty Submissions: 누구나 읽기
CREATE POLICY "bounty_select" ON public.bounty_submissions FOR SELECT USING (true);
CREATE POLICY "bounty_insert" ON public.bounty_submissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Events: 누구나 읽기
CREATE POLICY "events_select" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_service_all" ON public.events FOR ALL USING (true);

-- Polls: 누구나 읽기
CREATE POLICY "polls_select" ON public.polls FOR SELECT USING (true);
CREATE POLICY "polls_service_all" ON public.polls FOR ALL USING (true);

-- Poll Votes: 본인 것만
CREATE POLICY "poll_votes_select" ON public.poll_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "poll_votes_insert" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usage Tracking: 본인 것만
CREATE POLICY "usage_select" ON public.usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "usage_all" ON public.usage_tracking FOR ALL USING (auth.uid() = user_id);

-- Gold Transactions: 본인 것만 읽기
CREATE POLICY "gold_txn_select" ON public.gold_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gold_txn_service_all" ON public.gold_transactions FOR ALL USING (true);

-- =============================================
-- Auto-create profile on signup (trigger)
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar, gold_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text || '@anonymous'),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    1000
  );
  -- Initialize usage tracking
  INSERT INTO public.usage_tracking (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Database views for common queries
-- =============================================

-- Agent list with owner name
CREATE OR REPLACE VIEW public.agents_view AS
SELECT a.*, p.name as owner_name
FROM public.agents a
LEFT JOIN public.profiles p ON a.owner_id = p.id;

-- Recent debates with agent names
CREATE OR REPLACE VIEW public.debates_view AS
SELECT
  d.*,
  a1.name as agent1_name,
  a2.name as agent2_name,
  CASE WHEN d.winner_id IS NOT NULL
    THEN (SELECT name FROM public.agents WHERE id = d.winner_id)
    ELSE NULL
  END as winner_name
FROM public.debates d
LEFT JOIN public.agents a1 ON d.agent1_id = a1.id
LEFT JOIN public.agents a2 ON d.agent2_id = a2.id;

-- Stocks with agent names
CREATE OR REPLACE VIEW public.stocks_view AS
SELECT s.*, a.name as agent_name
FROM public.agent_stocks s
LEFT JOIN public.agents a ON s.agent_id = a.id;
