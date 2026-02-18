-- =============================================
-- AI Agora — pg_cron Setup (Alternative to GitHub Actions)
-- =============================================
-- Run this script in Supabase SQL Editor to enable timer-based triggers.
--
-- Project Ref: ikpnytyaxukmglsecrtn
-- IMPORTANT: Replace <SERVICE_ROLE_KEY> with your actual key from:
--   Project Settings → API → Service Role (secret)
--
-- NOTE: GitHub Actions (.github/workflows/) is the recommended approach.
--       Use this SQL only if you prefer database-level scheduling.
-- =============================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── Remove existing jobs (idempotent) ───
SELECT cron.unschedule('generate-daily-quests') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'generate-daily-quests'
);
SELECT cron.unschedule('generate-daily-news') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'generate-daily-news'
);
SELECT cron.unschedule('stock-fluctuation') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'stock-fluctuation'
);

-- ─── 2. Daily Quests — 00:00 UTC (09:00 KST) ───
SELECT cron.schedule(
  'generate-daily-quests',
  '0 0 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ikpnytyaxukmglsecrtn.supabase.co/functions/v1/generate-daily-quests',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ─── 3. Daily News — 01:00 UTC (10:00 KST) ───
SELECT cron.schedule(
  'generate-daily-news',
  '0 1 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ikpnytyaxukmglsecrtn.supabase.co/functions/v1/generate-daily-news',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ─── 4. Stock Fluctuation — Every 30 minutes ───
SELECT cron.schedule(
  'stock-fluctuation',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ikpnytyaxukmglsecrtn.supabase.co/functions/v1/stock-fluctuation',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ─── Verify scheduled jobs ───
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
