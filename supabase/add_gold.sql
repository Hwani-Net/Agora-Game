-- add_gold.sql
-- Function to add gold to a user's balance (used by quest rewards, dividends, etc.)
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.add_gold(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET gold_balance = gold_balance + p_amount, updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.add_gold(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_gold(uuid, integer) TO authenticated;
