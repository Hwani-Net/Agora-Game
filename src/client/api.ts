/**
 * api.ts — Supabase Data Access Layer
 * =====================================
 * All read operations use supabase-js directly.
 * Write operations that need server-side logic (AI debates) use Edge Functions.
 * Streaming mode uses raw fetch for SSE support.
 */

import { supabase } from './supabase.js';

// ─── Agents ───

export async function fetchAgents(options?: {
  limit?: number;
  sortBy?: string;
  faction?: string;
}): Promise<{ agents: unknown[]; total: number }> {
  const { limit = 20, sortBy = 'elo_score', faction } = options || {};

  let countQuery = supabase.from('agents').select('*', { count: 'exact', head: true });
  if (faction) countQuery = countQuery.eq('faction', faction);
  const { count } = await countQuery;

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
  if (!user) throw new Error('LOGIN_REQUIRED');

  const id = crypto.randomUUID();
  const { data, error } = await supabase.from('agents').insert({
    id,
    name: agent.name,
    persona: agent.persona,
    philosophy: agent.persona,
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

export async function fetchTopics(t: (key: string) => string): Promise<string[]> {
  return [
    t('arena.topics.t1'),
    t('arena.topics.t2'),
    t('arena.topics.t3'),
    t('arena.topics.t4'),
    t('arena.topics.t5'),
  ];
}

export async function startAutoBattle(): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('run-debate', {
    body: { mode: 'auto' },
  });
  if (error) throw new Error(error.message || 'DEBATE_START_FAILED');
  return data;
}

// ─── SSE Streaming Debate ───

export type DebateEvent = {
  type: 'matched' | 'round_start' | 'speaking' | 'argument' | 'judging' | 'result' | 'complete' | 'error';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
};

export function streamDebate(
  onEvent: (event: DebateEvent) => void,
  signal?: AbortSignal,
): void {
  const supabaseUrl: string = import.meta.env?.VITE_SUPABASE_URL || '';
  const supabaseAnonKey: string = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

  const url = `${supabaseUrl}/functions/v1/run-debate`;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ mode: 'auto', stream: true }),
    signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        onEvent({ type: 'error', data: { message: `SERVER_ERROR:${response.status}:${text}` } });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onEvent({ type: 'error', data: { message: 'STREAM_READ_FAILED' } });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.trim().split('\n');
          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (eventType && eventData) {
            try {
              const parsed = JSON.parse(eventData);
              onEvent({ type: eventType as DebateEvent['type'], data: parsed });
            } catch {
              console.warn('Failed to parse SSE data:', eventData);
            }
          }
        }
      }
    })
    .catch((err) => {
      if (signal?.aborted) return;
      onEvent({ type: 'error', data: { message: err instanceof Error ? err.message : 'Network error' } });
    });
}

// ─── Stocks ───

export async function fetchStocks(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('stocks_view')
    .select('*');

  if (error) {
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

// ─── Stock Trading ───

export interface TradeResult {
  success?: boolean;
  error?: string;
  action?: string;
  shares?: number;
  price?: number;
  total_cost?: number;
  total_revenue?: number;
  new_gold_balance?: number;
  shares_owned?: number;
  avg_buy_price?: number;
  profit?: number;
}

export async function tradeStock(
  stockId: string,
  action: 'buy' | 'sell',
  shares: number,
): Promise<TradeResult> {
  const { data, error } = await supabase.functions.invoke('trade-stock', {
    body: { action, stock_id: stockId, shares },
  });
  if (error) throw new Error(error.message || 'TRADE_FAILED');
  if (data?.error) throw new Error(data.error);
  return data as TradeResult;
}

export interface PortfolioItem {
  stock_id: string;
  agent_name: string;
  shares_owned: number;
  avg_buy_price: number;
  current_price: number;
  total_value: number;
  profit: number;
  profit_pct: number;
}

export async function fetchPortfolio(): Promise<PortfolioItem[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: ownership, error } = await supabase
      .from('stock_ownership')
      .select('stock_id, shares_owned, avg_buy_price')
      .eq('user_id', user.id);

    if (error || !ownership || ownership.length === 0) return [];

    // Fetch stock data separately for reliability
    const stockIds = ownership.map((o) => o.stock_id);
    const { data: stocks } = await supabase
      .from('agent_stocks')
      .select('id, current_price, agent_id')
      .in('id', stockIds);

    // Fetch agent names
    const agentIds = (stocks || []).map((s) => s.agent_id);
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name')
      .in('id', agentIds);

    const stockMap = new Map((stocks || []).map((s) => [s.id, s]));
    const agentMap = new Map((agents || []).map((a) => [a.id, a.name]));

    return ownership.map((o) => {
      const stock = stockMap.get(o.stock_id);
      const currentPrice = stock?.current_price ?? 0;
      const sharesOwned = o.shares_owned ?? 0;
      const avgBuyPrice = o.avg_buy_price ?? 0;
      const totalValue = currentPrice * sharesOwned;
      const costBasis = avgBuyPrice * sharesOwned;
      const profit = totalValue - costBasis;
      const profitPct = costBasis > 0 ? (profit / costBasis) * 100 : 0;
      const agentName = stock ? (agentMap.get(stock.agent_id) || 'Unknown') : 'Unknown';

      return {
        stock_id: o.stock_id,
        agent_name: agentName,
        shares_owned: sharesOwned,
        avg_buy_price: avgBuyPrice,
        current_price: currentPrice,
        total_value: totalValue,
        profit,
        profit_pct: profitPct,
      };
    });
  } catch (err) {
    console.error('fetchPortfolio error:', err);
    return [];
  }
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

  const [{ count: agentsCount }, portfolio] = await Promise.all([
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
    fetchPortfolio(),
  ]);

  const portfolioValue = portfolio.reduce((sum, item) => sum + item.total_value, 0);

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    isPremium: data.is_premium,
    gold_balance: data.gold_balance,
    agents_count: agentsCount || 0,
    portfolio_value: Math.round(portfolioValue),
  };
}

// ─── Trade History ───

export interface TradeRecord {
  id: string;
  agent_name: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  total_amount: number;
  timestamp: string;
}

export interface GoldTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  timestamp: string;
}

export async function fetchRecentTrades(limit = 10): Promise<TradeRecord[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: txns, error } = await supabase
      .from('stock_transactions')
      .select('id, stock_id, type, shares, price, total_amount, timestamp')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error || !txns || txns.length === 0) return [];

    // Resolve agent names
    const stockIds = [...new Set(txns.map((t) => t.stock_id))];
    const { data: stocks } = await supabase
      .from('agent_stocks')
      .select('id, agent_id')
      .in('id', stockIds);

    const agentIds = [...new Set((stocks || []).map((s) => s.agent_id))];
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name')
      .in('id', agentIds);

    const stockToAgent = new Map((stocks || []).map((s) => [s.id, s.agent_id]));
    const agentMap = new Map((agents || []).map((a) => [a.id, a.name]));

    return txns.map((t) => ({
      id: t.id,
      agent_name: agentMap.get(stockToAgent.get(t.stock_id) || '') || 'Unknown',
      type: t.type as 'buy' | 'sell',
      shares: t.shares,
      price: t.price,
      total_amount: t.total_amount,
      timestamp: t.timestamp,
    }));
  } catch (err) {
    console.error('fetchRecentTrades error:', err);
    return [];
  }
}

export async function fetchGoldHistory(limit = 10): Promise<GoldTransaction[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('gold_transactions')
      .select('id, amount, type, description, timestamp')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []) as GoldTransaction[];
  } catch (err) {
    console.error('fetchGoldHistory error:', err);
    return [];
  }
}
