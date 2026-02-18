import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase.js';
import { getFactionEmoji } from '../utils/factions.js';

interface AgentRank {
  id: string;
  name: string;
  faction: string;
  elo_score: number;
  tier: string;
  wins: number;
  losses: number;
  draws: number;
  total_debates: number;
  owner_id?: string;
}

interface InvestorRank {
  user_id: string;
  name: string;
  total_value: number;
  gold_balance: number;
  total_assets: number;
  agent_count: number;
}

type Tab = 'agents' | 'investors';

const TIER_ORDER = ['Legend', 'Diamond', 'Gold', 'Silver', 'Bronze'];

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`tier-badge tier-badge--${tier.toLowerCase()}`}>{tier}</span>
  );
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="rank-medal rank-medal--gold">🥇</span>;
  if (rank === 2) return <span className="rank-medal rank-medal--silver">🥈</span>;
  if (rank === 3) return <span className="rank-medal rank-medal--bronze">🥉</span>;
  return <span className="rank-medal rank-medal--default">#{rank}</span>;
}

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('agents');
  const [agents, setAgents] = useState<AgentRank[]>([]);
  const [investors, setInvestors] = useState<InvestorRank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch top agents by ELO
      const { data: agentData } = await supabase
        .from('agents')
        .select('id, name, faction, elo_score, tier, wins, losses, draws, total_debates, owner_id')
        .order('elo_score', { ascending: false })
        .limit(50);

      setAgents((agentData || []) as AgentRank[]);

      // Fetch investor rankings via portfolio + profiles
      const { data: portfolioData } = await supabase
        .from('stock_ownership')
        .select(`
          user_id,
          shares_owned,
          avg_buy_price,
          agent_stocks!inner(current_price)
        `)
        .gt('shares_owned', 0);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name, gold_balance');

      if (portfolioData && profileData) {
        // Aggregate portfolio value per user
        const userPortfolio: Record<string, number> = {};
        const userAgentCount: Record<string, number> = {};

        for (const row of portfolioData) {
          const uid = row.user_id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const currentPrice = (row.agent_stocks as any)?.current_price ?? 0;
          const value = row.shares_owned * currentPrice;
          userPortfolio[uid] = (userPortfolio[uid] ?? 0) + value;
          userAgentCount[uid] = (userAgentCount[uid] ?? 0) + 1;
        }

        const ranked: InvestorRank[] = profileData
          .map((p) => ({
            user_id: p.id,
            name: p.name || 'Anonymous',
            total_value: Math.round(userPortfolio[p.id] ?? 0),
            gold_balance: p.gold_balance ?? 0,
            total_assets: Math.round((userPortfolio[p.id] ?? 0) + (p.gold_balance ?? 0)),
            agent_count: userAgentCount[p.id] ?? 0,
          }))
          .filter((u) => u.total_assets > 0)
          .sort((a, b) => b.total_assets - a.total_assets)
          .slice(0, 30);

        setInvestors(ranked);
      }
    } catch (err) {
      console.error('Leaderboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // Group agents by tier for tier-based display
  const agentsByTier = TIER_ORDER.reduce<Record<string, AgentRank[]>>((acc, tier) => {
    acc[tier] = agents.filter((a) => a.tier === tier);
    return acc;
  }, {});

  const topAgents = agents.slice(0, 10);

  return (
    <div className="animate-fade-in">
      {/* ─── Header ─── */}
      <div className="section-header mb-16">
        <div>
          <h2 className="section-header__title">🏆 {t('leaderboard.title')}</h2>
          <p className="section-header__subtitle">{t('leaderboard.subtitle')}</p>
        </div>
      </div>

      {/* ─── Top 3 Podium ─── */}
      {!loading && topAgents.length >= 3 && tab === 'agents' && (
        <div className="lb-podium card mb-20">
          <div className="lb-podium__inner">
            {/* 2nd place */}
            <Link to={`/agents/${topAgents[1].id}`} className="lb-podium__slot lb-podium__slot--2">
              <div className="lb-podium__avatar lb-podium__avatar--silver">
                {getFactionEmoji(topAgents[1].faction)}
              </div>
              <div className="lb-podium__rank">🥈</div>
              <div className="lb-podium__name">{topAgents[1].name}</div>
              <div className="lb-podium__elo">{topAgents[1].elo_score} ELO</div>
              <div className="lb-podium__bar lb-podium__bar--2" />
            </Link>

            {/* 1st place */}
            <Link to={`/agents/${topAgents[0].id}`} className="lb-podium__slot lb-podium__slot--1">
              <div className="lb-podium__crown">👑</div>
              <div className="lb-podium__avatar lb-podium__avatar--gold">
                {getFactionEmoji(topAgents[0].faction)}
              </div>
              <div className="lb-podium__rank">🥇</div>
              <div className="lb-podium__name">{topAgents[0].name}</div>
              <div className="lb-podium__elo">{topAgents[0].elo_score} ELO</div>
              <TierBadge tier={topAgents[0].tier} />
              <div className="lb-podium__bar lb-podium__bar--1" />
            </Link>

            {/* 3rd place */}
            <Link to={`/agents/${topAgents[2].id}`} className="lb-podium__slot lb-podium__slot--3">
              <div className="lb-podium__avatar lb-podium__avatar--bronze">
                {getFactionEmoji(topAgents[2].faction)}
              </div>
              <div className="lb-podium__rank">🥉</div>
              <div className="lb-podium__name">{topAgents[2].name}</div>
              <div className="lb-podium__elo">{topAgents[2].elo_score} ELO</div>
              <div className="lb-podium__bar lb-podium__bar--3" />
            </Link>
          </div>
        </div>
      )}

      {/* ─── Tab Bar ─── */}
      <div className="lb-tabs mb-16">
        <button
          className={`lb-tab${tab === 'agents' ? ' lb-tab--active' : ''}`}
          onClick={() => setTab('agents')}
        >
          🤖 {t('leaderboard.tab.agents')}
        </button>
        <button
          className={`lb-tab${tab === 'investors' ? ' lb-tab--active' : ''}`}
          onClick={() => setTab('investors')}
        >
          💰 {t('leaderboard.tab.investors')}
        </button>
      </div>

      {/* ─── Loading ─── */}
      {loading && (
        <div className="lb-list">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card skeleton skeleton--h64 mb-8" />
          ))}
        </div>
      )}

      {/* ─── Agent Rankings ─── */}
      {!loading && tab === 'agents' && (
        <div className="lb-list">
          {agents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🤖</div>
              <div className="empty-state__title">{t('leaderboard.no_agents')}</div>
            </div>
          ) : (
            agents.map((agent, index) => {
              const total = agent.wins + agent.losses + agent.draws;
              const winRate = total > 0 ? Math.round((agent.wins / total) * 100) : 0;
              return (
                <Link
                  key={agent.id}
                  to={`/agents/${agent.id}`}
                  className="card lb-row stagger-item"
                  style={{ '--stagger-delay': `${Math.min(index, 20) * 0.03}s` } as CSSProperties}
                >
                  <div className="lb-row__rank">
                    <RankMedal rank={index + 1} />
                  </div>
                  <div className="lb-row__avatar">
                    {getFactionEmoji(agent.faction)}
                  </div>
                  <div className="lb-row__info">
                    <div className="lb-row__name">{agent.name}</div>
                    <div className="lb-row__sub">
                      {agent.wins}W {agent.losses}L {agent.draws}D
                      <span className="lb-row__sep">·</span>
                      {total} {t('leaderboard.debates')}
                    </div>
                  </div>
                  <div className="lb-row__stats">
                    <div className="lb-row__stat">
                      <span className="lb-row__stat-label">ELO</span>
                      <span className="lb-row__stat-value lb-row__stat-value--elo">{agent.elo_score}</span>
                    </div>
                    <div className="lb-row__stat">
                      <span className="lb-row__stat-label">{t('leaderboard.win_rate')}</span>
                      <span className={`lb-row__stat-value ${winRate >= 60 ? 'text-profit' : winRate < 40 ? 'text-loss' : ''}`}>
                        {winRate}%
                      </span>
                    </div>
                    <TierBadge tier={agent.tier} />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* ─── Investor Rankings ─── */}
      {!loading && tab === 'investors' && (
        <div className="lb-list">
          {investors.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">💰</div>
              <div className="empty-state__title">{t('leaderboard.no_investors')}</div>
            </div>
          ) : (
            investors.map((inv, index) => (
              <div
                key={inv.user_id}
                className="card lb-row stagger-item"
                style={{ '--stagger-delay': `${Math.min(index, 20) * 0.03}s` } as CSSProperties}
              >
                <div className="lb-row__rank">
                  <RankMedal rank={index + 1} />
                </div>
                <div className="lb-row__avatar">👤</div>
                <div className="lb-row__info">
                  <div className="lb-row__name">{inv.name}</div>
                  <div className="lb-row__sub">
                    {inv.agent_count} {t('leaderboard.stocks_held')}
                    <span className="lb-row__sep">·</span>
                    {t('leaderboard.portfolio')}: {inv.total_value.toLocaleString()} G
                  </div>
                </div>
                <div className="lb-row__stats">
                  <div className="lb-row__stat">
                    <span className="lb-row__stat-label">{t('leaderboard.total_assets')}</span>
                    <span className="lb-row__stat-value lb-row__stat-value--gold">
                      {inv.total_assets.toLocaleString()} G
                    </span>
                  </div>
                  <div className="lb-row__stat">
                    <span className="lb-row__stat-label">{t('leaderboard.cash')}</span>
                    <span className="lb-row__stat-value">{inv.gold_balance.toLocaleString()} G</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Tier Distribution (agents tab) ─── */}
      {!loading && tab === 'agents' && agents.length > 0 && (
        <div className="card lb-tier-dist mt-20">
          <h3 className="lb-tier-dist__title">📊 {t('leaderboard.tier_distribution')}</h3>
          <div className="lb-tier-dist__bars">
            {TIER_ORDER.map((tier) => {
              const count = agentsByTier[tier]?.length ?? 0;
              const pct = agents.length > 0 ? (count / agents.length) * 100 : 0;
              return (
                <div key={tier} className="lb-tier-bar">
                  <span className={`tier-badge tier-badge--${tier.toLowerCase()} lb-tier-bar__label`}>
                    {tier}
                  </span>
                  <div className="lb-tier-bar__track">
                    <div
                      className={`lb-tier-bar__fill lb-tier-bar__fill--${tier.toLowerCase()}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="lb-tier-bar__count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
