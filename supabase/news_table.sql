-- news table for AI-generated daily news
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.news (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT DEFAULT '',
  generated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Anyone can read news
CREATE POLICY "news_select" ON public.news
  FOR SELECT USING (true);

-- Only service_role can insert/update (Edge Functions)
CREATE POLICY "news_insert_service" ON public.news
  FOR INSERT WITH CHECK (true);

GRANT SELECT ON public.news TO anon;
GRANT SELECT ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;
