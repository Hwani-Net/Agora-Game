/**
 * api.ts — Supabase Data Access Layer
 * =====================================
 * Replaces the old fetch-based API client with Supabase queries.
 * All read operations use supabase-js directly.
 * Write operations that need server-side logic (AI debates) use Edge Functions.
 */

import { supabase } from './supabase.js';

// ─── Agents ───

export async function fetchAgents(options?: {
  limit?: number;
  sortBy?: string;
  faction?: string;
}): Promise<{ agents: unknown[]; total: number }> {
  const { limit = 20, sortBy = 'elo_score', faction } = options || {};

  // Get total count
  let countQuery = supabase.from('agents').select('*', { count: 'exact', head: true });
  if (faction) countQuery = countQuery.eq('faction', faction);
  const { count } = await countQuery;

  // Get agents
  let query = supabase.from('agents').select('*');
  if (faction) query = query.eq('faction', faction);
  query = query.order(sortBy, { ascending: false });
  if (limit > 0) query = query.limit(limit);
  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return { agents: data || [], total: count || 0 };
}

export async function getAgentById(id: string) {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getAgentDebates(agentId: string) {
  const { data, error } = await supabase
    .from('debates_view')
    .select('*')
    .or(`agent1_id.eq.${agentId},agent2_id.eq.${agentId}`)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export async function getAgentStock(agentId: string) {
  const { data } = await supabase
    .from('agent_stocks')
    .select('*')
    .eq('agent_id', agentId)
    .single();
  return data;
}

export async function createAgent(agent: {
  name: string;
  persona: string;
  faction: string;
}): Promise<unknown> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const id = crypto.randomUUID();
  const { data, error } = await supabase.from('agents').insert({
    id,
    name: agent.name,
    persona: agent.persona,
    philosophy: agent.persona, // Use persona as philosophy for now
    faction: agent.faction,
    owner_id: user.id,
  }).select().single();

  if (error) throw new Error(error.message);
  return data;
}

// ─── Debates ───

export async function fetchRecentDebates(limit = 10): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('debates_view')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    // Fallback if view doesn't exist — query tables directly
    const { data: fallback } = await supabase
      .from('debates')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    return fallback || [];
  }
  return data || [];
}

export async function getDebateById(id: string) {
  const { data, error } = await supabase
    .from('debates_view')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTopics(): Promise<string[]> {
  // Return static topics since we no longer have arena.ts
  return [
    'AI 규제가 필요한가?',
    '기본소득은 실현 가능한가?',
    '자본주의는 최선의 시스템인가?',
    '교육은 무상이어야 하는가?',
    '기술이 인간을 자유롭게 하는가?',
  ];
}

export async function startAutoBattle(): Promise<unknown> {
  // Edge Function 호출 (Phase 3에서 구현)
  const { data, error } = await supabase.functions.invoke('run-debate', {
    body: { mode: 'auto' },
  });
  if (error) throw new Error(error.message || 'AI 토론 시작에 실패했습니다.');
  return data;
}

// ─── Stocks ───

export async function fetchStocks(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('stocks_view')
    .select('*');

  if (error) {
    // Fallback without view
    const { data: fallback } = await supabase
      .from('agent_stocks')
      .select('*, agents(name)')
      .order('current_price', { ascending: false });
    return (fallback || []).map((s: Record<string, unknown>) => ({
      ...s,
      agent_name: (s.agents as { name?: string } | null)?.name,
    }));
  }
  return data || [];
}

// ─── Quests ───

export async function fetchQuests(type?: string): Promise<unknown[]> {
  let query = supabase.from('quests').select('*').order('created_at', { ascending: false });
  if (type && type !== 'all') {
    query = query.eq('type', type);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// ─── User Profile ───

export async function fetchProfile(): Promise<unknown | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!data) return null;

  // Enrich with agents count
  const { count: agentsCount } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user.id);

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    isPremium: data.is_premium,
    gold_balance: data.gold_balance,
    agents_count: agentsCount || 0,
    portfolio_value: 0,
  };
}
