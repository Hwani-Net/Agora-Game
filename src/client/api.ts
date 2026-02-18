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
  ownerId?: string;
}): Promise<{ agents: unknown[]; total: number }> {
  const { limit = 20, sortBy = 'elo_score', faction, ownerId } = options || {};

  let countQuery = supabase.from('agents').select('*', { count: 'exact', head: true });
  if (faction) countQuery = countQuery.eq('faction', faction);
  if (ownerId) countQuery = countQuery.eq('owner_id', ownerId);
  const { count } = await countQuery;

  let query = supabase.from('agents').select('*');
  if (faction) query = query.eq('faction', faction);
  if (ownerId) query = query.eq('owner_id', ownerId);
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

export async function fetchStockHistory(stockId: string) {
  const { data, error } = await supabase
    .from('stock_price_history')
    .select('price, timestamp')
    .eq('stock_id', stockId)
    .order('timestamp', { ascending: true })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function capturePortfolioSnapshot() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const { error } = await supabase.rpc('capture_portfolio_snapshot', {
    p_user_id: user.id
  });
  if (error) console.warn('Snapshot skipped:', error.message);
}

export async function fetchPortfolioHistory() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('portfolio_history')
    .select('total_assets, recorded_at')
    .eq('user_id', user.id)
    .order('recorded_at', { ascending: true })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}


export async function createAgent(agent: {
  name: string;
  persona: string;
  faction: string;
  philosophy?: string;
}): Promise<unknown> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('LOGIN_REQUIRED');

  const id = crypto.randomUUID();
  const { data, error } = await supabase.from('agents').insert({
    id,
    name: agent.name,
    persona: agent.persona,
    philosophy: agent.philosophy || agent.persona,
    faction: agent.faction,
    owner_id: user.id,
  }).select().single();

  if (error) throw new Error(error.message);

  // Auto-IPO: list on stock market at initial price 100G
  const INITIAL_PRICE = 100;
  const TOTAL_SHARES = 1000;
  await supabase.from('agent_stocks').insert({
    id: crypto.randomUUID(),
    agent_id: id,
    current_price: INITIAL_PRICE,
    total_shares: TOTAL_SHARES,
    available_shares: TOTAL_SHARES,
    market_cap: INITIAL_PRICE * TOTAL_SHARES,
    price_change_24h: 0,
  });

  return data;
}

// ─── Top Agents (Leaderboard) ───

export async function fetchTopAgents(limit = 5): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, faction, elo_score, tier, wins, losses, draws, total_debates')
    .gt('total_debates', 0)
    .order('elo_score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ─── Agent Cheers ───

export async function getAgentCheers(agentId: string): Promise<{ count: number; recent: unknown[] }> {
  const { count, error: countError } = await supabase
    .from('agent_cheers')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId);

  if (countError) throw countError;

  const { data: recent, error: recentError } = await supabase
    .from('agent_cheers')
    .select('id, message, created_at, user_id')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentError) throw recentError;

  return { count: count ?? 0, recent: recent || [] };
}

export async function cheerAgent(agentId: string, userId: string, message = ''): Promise<void> {
  const id = `cheer_${userId}_${agentId}_${Date.now()}`;
  const { error } = await supabase
    .from('agent_cheers')
    .insert({ id, user_id: userId, agent_id: agentId, message });

  if (error) throw error;
}

export async function getUserCheerCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('agent_cheers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return count ?? 0;
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
  type: 'matched' | 'round_start' | 'speaking' | 'argument' | 'judging' | 'result' | 'complete' | 'error' | 'score_update';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
};

export interface DebateResult {
  winner: {
    name: string;
    eloChange: number;
    newElo: number;
  };
  loser: {
    name: string;
    eloChange: number;
    newElo: number;
  };
  scores: {
    agent1: { logic: number; evidence: number; persuasion: number };
    agent2: { logic: number; evidence: number; persuasion: number };
  };
  reasoning: string;
}

export function streamDebate(
  onEvent: (event: DebateEvent) => void,
  signal?: AbortSignal,
  topic?: string,
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
    body: JSON.stringify({ mode: 'auto', stream: true, ...(topic ? { topic } : {}) }),
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
  agent_id: string;
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
        agent_id: stock?.agent_id || '',
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

export async function createBountyQuest(quest: {
  title: string;
  description: string;
  reward_gold: number;
  difficulty: string;
  deadline_hours: number;
}): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Login required');

  const questId = crypto.randomUUID();
  const deadline = new Date(Date.now() + quest.deadline_hours * 60 * 60 * 1000).toISOString();

  // Deduct gold from user (bounty cost)
  const { error: goldErr } = await supabase.rpc('add_gold', {
    p_user_id: session.user.id,
    p_amount: -quest.reward_gold,
  });
  if (goldErr) throw new Error(goldErr.message);

  // Log gold transaction
  await supabase.from('gold_transactions').insert({
    id: crypto.randomUUID(),
    user_id: session.user.id,
    amount: -quest.reward_gold,
    type: 'bounty_create',
    description: `Bounty: ${quest.title}`,
  });

  const { data, error } = await supabase.from('quests').insert({
    id: questId,
    type: 'bounty',
    title: quest.title,
    description: quest.description,
    reward_gold: quest.reward_gold,
    difficulty: quest.difficulty,
    status: 'open',
    creator_id: session.user.id,
    deadline,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function generateDailyQuests(): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('generate-daily-quests');
  if (error) throw new Error(error.message || 'Failed to generate quests');
  return data;
}

// ─── News ───

export async function fetchNews(limit = 20): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('fetchNews error:', error.message);
    return [];
  }
  return data || [];
}

export async function generateDailyNews(): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('generate-daily-news');
  if (error) throw new Error(error.message || 'Failed to generate news');
  return data;
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
      .select('id, stock_id, type, shares, price, total_amount, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
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
      timestamp: t.created_at,
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
// ─── Shareholder Proposals ───

export interface Proposal {
  id: string;
  topic: string;
  votes: number;
  created_at: string;
  user_voted?: boolean;
}

export async function getProposals(agentId: string): Promise<Proposal[]> {
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Fetch proposals
  const { data: proposals, error } = await supabase
    .from('topic_proposals')
    .select('*')
    .eq('agent_id', agentId)
    .order('votes', { ascending: false });

  if (error) throw new Error(error.message);
  if (!proposals) return [];

  // 2. Check if user voted (if logged in)
  let votedProposalIds = new Set<string>();
  if (user) {
    const { data: votes } = await supabase
      .from('proposal_votes')
      .select('proposal_id')
      .eq('user_id', user.id)
      .in('proposal_id', proposals.map(p => p.id));
    
    if (votes) {
      votes.forEach(v => votedProposalIds.add(v.proposal_id));
    }
  }

  return proposals.map(p => ({
    ...p,
    user_voted: votedProposalIds.has(p.id)
  }));
}

export async function createProposal(agentId: string, topic: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('LOGIN_REQUIRED');

  // Proper check: Get stock_id for agent -> check ownership
  const { data: stock } = await supabase
    .from('agent_stocks')
    .select('id')
    .eq('agent_id', agentId)
    .single();

    
  if (!stock) throw new Error('STOCK_NOT_FOUND');

  const { data: shareData } = await supabase
    .from('stock_ownership')
    .select('shares_owned') // Column name is shares_owned
    .eq('user_id', user.id)
    .eq('stock_id', stock.id)
    .single();

  if (!shareData || shareData.shares_owned < 1) {
    throw new Error('MUST_BE_SHAREHOLDER');
  }

  const { error } = await supabase
    .from('topic_proposals')
    .insert({
      agent_id: agentId,
      user_id: user.id,
      topic: topic,
    });

  if (error) throw new Error(error.message);
}

export async function voteProposal(proposalId: string, agentId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('LOGIN_REQUIRED');

  // 1. Get user's share count
  const { data: stock } = await supabase
    .from('agent_stocks')
    .select('id')
    .eq('agent_id', agentId)
    .single();
    
  if (!stock) throw new Error('STOCK_NOT_FOUND');

  const { data: shareData } = await supabase
    .from('stock_ownership')
    .select('shares_owned')
    .eq('user_id', user.id)
    .eq('stock_id', stock.id)
    .single();

  const shares = shareData?.shares_owned || 0;
  if (shares <= 0) throw new Error('NO_SHARES_TO_VOTE');

  // 2. Call RPC to vote
  const { error } = await supabase.rpc('vote_proposal', {
    proposal_id_input: proposalId,
    shares_count: shares
  });

  if (error) throw new Error(error.message);
}

// ─── Bounty Quests ───

export async function fetchBountySubmissions(questId: string) {
  const { data, error } = await supabase
    .from('bounty_submissions')
    .select(`
      *,
      agents:agent_id (name, faction, elo_score, persona)
    `)
    .eq('quest_id', questId)
    .order('votes', { ascending: false });

  if (error) throw error;
  return data;
}

export async function triggerBountyResponse(questId: string) {
  const { data, error } = await supabase.functions.invoke('respond-bounty', {
    body: { quest_id: questId },
  });
  if (error) throw error;
  return data;
}

export async function awardBounty(questId: string, submissionId: string) {
  // 1. Mark quest as completed and set solver
  const { data: sub } = await supabase
    .from('bounty_submissions')
    .select('agent_id')
    .eq('id', submissionId)
    .single();

  if (!sub) throw new Error('SUBMISSION_NOT_FOUND');

  const { error: qError } = await supabase
    .from('quests')
    .update({ 
      status: 'completed',
      solver_agent_id: sub.agent_id
    })
    .eq('id', questId);

  if (qError) throw qError;

  return { success: true };
}

// ─── Usage & Limits ───

export async function fetchUsageStats(): Promise<{
  debates_today: number;
  trades_today: number;
  last_debate_date: string;
  last_trade_date: string;
} | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data;
}

