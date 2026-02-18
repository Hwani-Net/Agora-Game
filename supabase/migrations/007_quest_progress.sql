-- =============================================
-- 007_quest_progress.sql
-- User Quests Tracking & Auto-Completion Triggers
-- =============================================

-- ─── 1. User Quests Table ───
-- Tracks progress for each user on specific quest types
CREATE TABLE IF NOT EXISTS public.user_quests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL, -- e.g., 'daily_trade', 'daily_debate', 'first_win'
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'claimed')),
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quest_id)
);

-- Essential for Realtime subscription to receive 'OLD' values on UPDATE
ALTER TABLE public.user_quests REPLICA IDENTITY FULL;

-- RLS
ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;

-- Users can read their own quests
CREATE POLICY "Users can read own quests" ON public.user_quests
  FOR SELECT USING (auth.uid() = user_id);

-- Only system/triggers can update quests (or specific client logic if needed, but triggers preferred)
CREATE POLICY "System updates quests" ON public.user_quests
  FOR ALL USING (true) WITH CHECK (true); -- Broad Policy for now (to allow client updates if needed)

-- ─── 2. Initialize Daily Quests on Signup ───
CREATE OR REPLACE FUNCTION public.init_daily_quests()
RETURNS TRIGGER AS $$
BEGIN
  -- Daily Trade Quest
  INSERT INTO public.user_quests (user_id, quest_id, target, status)
  VALUES (NEW.id, 'daily_trade', 1, 'in_progress')
  ON CONFLICT DO NOTHING;

  -- Daily Debate Quest
  INSERT INTO public.user_quests (user_id, quest_id, target, status)
  VALUES (NEW.id, 'daily_debate', 1, 'in_progress')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on profile creation (which happens on auth signup)
CREATE OR REPLACE TRIGGER on_profile_created_quests
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.init_daily_quests();

-- ─── 3. Quest Logic: Stock Trade ───
CREATE OR REPLACE FUNCTION public.handle_trade_quest()
RETURNS TRIGGER AS $$
DECLARE
  q_record RECORD;
BEGIN
  -- Find the daily_trade quest for this user
  SELECT * FROM public.user_quests 
  WHERE user_id = NEW.user_id AND quest_id = 'daily_trade'
  INTO q_record;

  -- If found and not completed, check if completed
  IF FOUND AND q_record.status = 'in_progress' THEN
    UPDATE public.user_quests
    SET progress = progress + 1,
        status = CASE WHEN (progress + 1) >= target THEN 'completed' ELSE 'in_progress' END,
        completed_at = CASE WHEN (progress + 1) >= target THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = q_record.id;
  -- If not found (migration case for existing users), create it as completed
  ELSIF NOT FOUND THEN
    INSERT INTO public.user_quests (user_id, quest_id, progress, target, status, completed_at)
    VALUES (NEW.user_id, 'daily_trade', 1, 1, 'completed', now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on stock_transactions INSERT
DROP TRIGGER IF EXISTS on_trade_quest_update ON public.stock_transactions;
CREATE TRIGGER on_trade_quest_update
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_trade_quest();

-- ─── 4. Quest Logic: Debate Completion ───
-- (Assuming 'debates' table has owner_id or agent owner tracking.
-- Since debates are agent vs agent, we need to find the OWNER of the participating agents.)
CREATE OR REPLACE FUNCTION public.handle_debate_quest()
RETURNS TRIGGER AS $$
DECLARE
  owner1 UUID;
  owner2 UUID;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get owners of agent1 and agent2
    SELECT owner_id INTO owner1 FROM public.agents WHERE id = NEW.agent1_id;
    SELECT owner_id INTO owner2 FROM public.agents WHERE id = NEW.agent2_id;

    -- Update Quest for Owner 1
    IF owner1 IS NOT NULL THEN
      UPDATE public.user_quests
      SET progress = progress + 1,
          status = 'completed',
          completed_at = now(),
          updated_at = now()
      WHERE user_id = owner1 AND quest_id = 'daily_debate' AND status = 'in_progress';
      
      -- If missing, insert as completed
      IF NOT FOUND THEN
        INSERT INTO public.user_quests (user_id, quest_id, progress, target, status, completed_at)
        VALUES (owner1, 'daily_debate', 1, 1, 'completed', now());
      END IF;
    END IF;

    -- Update Quest for Owner 2 (if different)
    IF owner2 IS NOT NULL AND (owner1 IS NULL OR owner1 != owner2) THEN
        UPDATE public.user_quests
        SET progress = progress + 1,
            status = 'completed',
            completed_at = now(),
            updated_at = now()
        WHERE user_id = owner2 AND quest_id = 'daily_debate' AND status = 'in_progress';

        IF NOT FOUND THEN
            INSERT INTO public.user_quests (user_id, quest_id, progress, target, status, completed_at)
            VALUES (owner2, 'daily_debate', 1, 1, 'completed', now());
        END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on debates UPDATE
DROP TRIGGER IF EXISTS on_debate_quest_update ON public.debates;
CREATE TRIGGER on_debate_quest_update
  AFTER UPDATE ON public.debates
  FOR EACH ROW EXECUTE FUNCTION public.handle_debate_quest();
