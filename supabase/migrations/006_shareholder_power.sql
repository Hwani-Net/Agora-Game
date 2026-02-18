-- =============================================
-- AI Agora v2.0: Shareholder Power System
-- =============================================

-- 1. Topic Proposals Table
CREATE TABLE IF NOT EXISTS public.topic_proposals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Proposals
ALTER TABLE public.topic_proposals ENABLE ROW LEVEL SECURITY;

-- Anyone can read proposals
CREATE POLICY "proposals_select_all" ON public.topic_proposals
  FOR SELECT USING (true);

-- Only shareholders can create (Logic enforced in Edge Function, but RLS allows authenticated insert for now)
CREATE POLICY "proposals_insert_auth" ON public.topic_proposals
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 2. Proposal Votes Table (to prevent double voting & track weight)
CREATE TABLE IF NOT EXISTS public.proposal_votes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  proposal_id TEXT NOT NULL REFERENCES public.topic_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shares_at_vote INTEGER NOT NULL, -- Voting power used
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proposal_id, user_id) -- One vote per proposal per user
);

-- RLS for Votes
ALTER TABLE public.proposal_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_select_all" ON public.proposal_votes
  FOR SELECT USING (true);

CREATE POLICY "votes_insert_auth" ON public.proposal_votes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. RPC to Vote (Handles atomic update)
CREATE OR REPLACE FUNCTION vote_proposal(proposal_id_input TEXT, shares_count INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Insert vote record
  INSERT INTO public.proposal_votes (proposal_id, user_id, shares_at_vote)
  VALUES (proposal_id_input, auth.uid(), shares_count);

  -- Update total votes
  UPDATE public.topic_proposals
  SET votes = votes + shares_count
  WHERE id = proposal_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
