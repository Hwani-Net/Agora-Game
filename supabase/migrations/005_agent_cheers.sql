-- Migration: Create agent_cheers table for the cheering system
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.agent_cheers (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  agent_id TEXT NOT NULL REFERENCES public.agents(id),
  message TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_cheers_agent ON public.agent_cheers(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_cheers_user ON public.agent_cheers(user_id);

-- RLS policies
ALTER TABLE public.agent_cheers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cheers" ON public.agent_cheers FOR SELECT USING (true);
CREATE POLICY "Auth users can insert cheers" ON public.agent_cheers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant access
GRANT ALL ON public.agent_cheers TO authenticated;
GRANT SELECT ON public.agent_cheers TO anon;
