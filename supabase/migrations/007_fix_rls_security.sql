-- =============================================
-- AI Agora: Fix RLS Security Vulnerabilities
-- =============================================
-- Problem: "FOR ALL USING (true)" policies allow anon/authenticated users
-- to INSERT/UPDATE/DELETE rows that should only be modified by service_role.
-- service_role bypasses RLS entirely, so these policies are unnecessary
-- and create attack vectors.

-- 1. agent_stocks: Remove overly-permissive ALL policy, keep SELECT only
DROP POLICY IF EXISTS "stocks_service_all" ON public.agent_stocks;
-- SELECT already covered by "stocks_select"

-- 2. debates: Remove open INSERT/UPDATE, keep SELECT only
DROP POLICY IF EXISTS "debates_service_insert" ON public.debates;
DROP POLICY IF EXISTS "debates_service_update" ON public.debates;
-- SELECT already covered by "debates_select"

-- 3. events: Remove open ALL, keep SELECT only
DROP POLICY IF EXISTS "events_service_all" ON public.events;
-- SELECT already covered by "events_select"

-- 4. polls: Remove open ALL, keep SELECT only
DROP POLICY IF EXISTS "polls_service_all" ON public.polls;
-- SELECT already covered by "polls_select"

-- 5. gold_transactions: Remove open ALL, keep user-specific SELECT
DROP POLICY IF EXISTS "gold_txn_service_all" ON public.gold_transactions;
-- SELECT already covered by "gold_txn_select" (auth.uid() = user_id)

-- 6. quests: Remove open UPDATE, keep SELECT + authenticated INSERT
DROP POLICY IF EXISTS "quests_update" ON public.quests;
-- SELECT covered by "quests_select", INSERT by "quests_insert"

-- =============================================
-- NOTE: Edge Functions use SUPABASE_SERVICE_ROLE_KEY which bypasses
-- RLS entirely. These DROP POLICY statements only affect
-- anon/authenticated clients (i.e., frontend requests).
-- =============================================
