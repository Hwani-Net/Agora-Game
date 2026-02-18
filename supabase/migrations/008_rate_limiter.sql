-- =============================================
-- AI Agora: Rate Limiter RPC (V2 Migration)
-- =============================================
-- Atomic check-and-increment for usage limits.
-- Free tier limits: debate=10/day, trade=20/day, agent_create=3 total
-- Premium users bypass all limits.

CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
  p_user_id UUID,
  p_action TEXT  -- 'debate', 'trade', 'agent_create'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage RECORD;
  v_profile RECORD;
  v_limit INTEGER;
  v_current INTEGER;
BEGIN
  -- Get profile (premium check)
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Premium users bypass all limits
  IF v_profile.is_premium THEN
    RETURN jsonb_build_object('allowed', true, 'premium', true);
  END IF;

  -- Get or create usage record (upsert)
  INSERT INTO usage_tracking (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_usage FROM usage_tracking WHERE user_id = p_user_id FOR UPDATE;

  -- Daily reset: if last recorded date is before today, reset counters
  IF v_usage.last_debate_date < CURRENT_DATE THEN
    UPDATE usage_tracking
    SET debates_today = 0, trades_today = 0,
        last_debate_date = CURRENT_DATE, last_trade_date = CURRENT_DATE
    WHERE user_id = p_user_id;
    v_usage.debates_today := 0;
    v_usage.trades_today := 0;
  END IF;

  -- Check limits based on action type
  IF p_action = 'debate' THEN
    v_limit := 10;
    v_current := v_usage.debates_today;
    IF v_current >= v_limit THEN
      RETURN jsonb_build_object('allowed', false, 'limit', v_limit, 'used', v_current,
        'message', 'Daily debate limit reached. Upgrade to Premium!');
    END IF;
    UPDATE usage_tracking SET debates_today = debates_today + 1 WHERE user_id = p_user_id;

  ELSIF p_action = 'trade' THEN
    v_limit := 20;
    v_current := v_usage.trades_today;
    IF v_current >= v_limit THEN
      RETURN jsonb_build_object('allowed', false, 'limit', v_limit, 'used', v_current,
        'message', 'Daily trade limit reached. Upgrade to Premium!');
    END IF;
    UPDATE usage_tracking SET trades_today = trades_today + 1 WHERE user_id = p_user_id;

  ELSIF p_action = 'agent_create' THEN
    v_limit := 3;
    SELECT COUNT(*) INTO v_current FROM agents WHERE owner_id = p_user_id;
    IF v_current >= v_limit THEN
      RETURN jsonb_build_object('allowed', false, 'limit', v_limit, 'used', v_current,
        'message', 'Free tier agent limit reached. Upgrade to Premium!');
    END IF;
    -- No counter increment for agent_create; we count from agents table directly

  ELSE
    RETURN jsonb_build_object('error', 'Unknown action: ' || p_action);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'limit', v_limit, 'used', v_current + 1);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, text) TO authenticated;
