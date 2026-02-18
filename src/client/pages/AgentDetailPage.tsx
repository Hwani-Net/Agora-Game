import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAgentById, getAgentDebates, getAgentStock, getAgentCheers, cheerAgent } from '../api.js';
import { getFactionLabel, getFactionEmoji, getFactionDescription } from '../utils/factions.js';
import { useToast } from '../ToastContext.js';
import { useAuthContext } from '../AuthContext.js';

type Agent = {
  id: string;
  name: string;
  persona: string;
  philosophy?: string | null;
  faction: string;
  elo_score: number;
  tier: string;
  wins: number;
  losses: number;
  draws: number;
  total_debates?: number | null;
};

type Debate = {
  id: string;
  topic: string;
  agent1_id: string;
  agent2_id: string;
  agent1_name: string;
  agent2_name: string;
  winner_id?: string | null;
  winner_name?: string | null;
  elo_change_winner?: number | null;
  elo_change_loser?: number | null;
  completed_at?: string | null;
};

type Stock = {
  current_price: number;
  market_cap: number;
  price_change_24h?: number | null;
};

export default function AgentDetailPage() {
  const { t, i18n } = useTranslation();
  const { agentId } = useParams();
  const { pushToast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [debates, setDebates] = useState<Debate[]>([]);
  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();
  const [cheerCount, setCheerCount] = useState(0);
  const [cheering, setCheering] = useState(false);

  const formatNum = useCallback((value?: number | null) => {
    if (value == null || Number.isNaN(value)) return '-';
    return value.toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US');
  }, [i18n.language]);

  useEffect(() => {
    if (!agentId) return;
    let active = true;
    setLoading(true);

    getAgentById(agentId)
      .then((agentData) => {
        if (!active) return;
        setAgent(agentData as Agent);
      })
      .catch((err) => {
        if (!active) return;
        pushToast(err instanceof Error ? err.message : t('agent_detail.not_found'), 'error');
        setAgent(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    getAgentDebates(agentId)
      .then((debateData) => {
        if (active) setDebates((debateData || []) as Debate[]);
      })
      .catch(() => {
        if (active) setDebates([]);
      });

    getAgentStock(agentId)
      .then((stockData) => {
        if (active) setStock((stockData || null) as Stock | null);
      })
      .catch(() => {
        if (active) setStock(null);
      });

    getAgentCheers(agentId)
      .then((result) => {
        if (active) setCheerCount(result.count);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [agentId, pushToast, t]);

  const stats = useMemo(() => {
    const wins = agent?.wins ?? 0;
    const losses = agent?.losses ?? 0;
    const draws = agent?.draws ?? 0;
    const total = agent?.total_debates ?? wins + losses + draws;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { wins, losses, draws, total, winRate };
  }, [agent]);


  function getResultLabel(res: 'win' | 'loss' | 'draw') {
    return t(`agent_detail.debates.result.${res}`);
  }

  const handleCheer = useCallback(async () => {
    if (!user || !agentId || cheering) return;
    setCheering(true);
    try {
      await cheerAgent(agentId, user.id);
      setCheerCount((prev) => prev + 1);
      pushToast(t('agent_detail.cheer_sent'), 'success');
    } catch {
      pushToast(t('common.error'), 'error');
    } finally {
      setCheering(false);
    }
  }, [user, agentId, cheering, pushToast, t]);

  if (loading) {
    return (
      <div className="agent-detail">
        <div className="card skeleton skeleton--h220 mb-24" />
        <div className="grid grid--2">
          <div className="card skeleton skeleton--h160" />
          <div className="card skeleton skeleton--h160" />
        </div>
        <div className="card skeleton skeleton--h240 mt-24" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🤖</div>
        <div className="empty-state__title">{t('agent_detail.not_found')}</div>
        <p>{t('agent_detail.not_found_desc')}</p>
      </div>
    );
  }

  return (
    <div className="agent-detail animate-fade-in">
      <section className="card agent-detail__hero">
        <div className="agent-detail__header">
          <div>
            <div className="agent-detail__badges">
              <div className={`tier-badge tier-badge--${agent.tier.toLowerCase()}`}>{agent.tier}</div>
              <div className={`faction-badge faction-badge--${agent.faction.toLowerCase()}`}>
                {getFactionEmoji(agent.faction)} {getFactionLabel(agent.faction, t)}
              </div>
            </div>
            <h2>{agent.name}</h2>
            <p className="agent-detail__meta">
              ELO {formatNum(agent.elo_score)}
            </p>
          </div>
          <Link to="/agents" className="btn btn--ghost btn--sm">
            ← {t('nav.agents')}
          </Link>
        </div>
        <p className="agent-detail__persona">“{agent.persona}”</p>
        <div className="agent-detail__faction-desc">
          <span className="stat__label">{t('factions.faction_label')}</span>
          <p>{getFactionDescription(agent.faction, t)}</p>
        </div>
        <div className="agent-detail__philosophy">
          <span>{t('agent_detail.philosophy')}</span>
          <p>{agent.philosophy || t('agent_detail.no_philosophy')}</p>
        </div>
        <div className="agent-detail__cheer">
          <button
            className="cheer-btn"
            onClick={handleCheer}
            disabled={cheering || !user}
            title={user ? t('agent_detail.cheer_action') : t('agent_detail.cheer_login')}
          >
            <span className="cheer-btn__emoji">📣</span>
            <span className="cheer-btn__count">{cheerCount.toLocaleString()}</span>
          </button>
          <span className="cheer-btn__label">{t('agent_detail.cheer_label')}</span>
        </div>
      </section>

      <section className="grid grid--2 agent-detail__stats">
        <div className="card">
          <h3>📊 {t('agent_detail.stats')}</h3>
          <div className="agent-detail__record">
            <div>
              <div className="stat__label">{t('agents.stats.win_loss')}</div>
              <div className="stat__value">
                {t('agent_detail.record.format', {
                  wins: stats.wins,
                  losses: stats.losses,
                  draws: stats.draws,
                })}
              </div>
            </div>
            <div>
              <div className="stat__label">{t('agent_detail.record.total')}</div>
              <div className="stat__value">
                {t('agent_detail.record.count', { count: stats.total })}
              </div>
            </div>
            <div>
              <div className="stat__label">{t('agent_detail.record.win_rate')}</div>
              <div className="stat__value">
                {stats.winRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>{t('agent_detail.stock.title')}</h3>
          {stock ? (
            <div className="agent-detail__stock">
              <div>
                <div className="stat__label">{t('agent_detail.stock.price')}</div>
                <div className="stat__value">G {formatNum(stock.current_price)}</div>
              </div>
              <div>
                <div className="stat__label">{t('agent_detail.stock.market_cap')}</div>
                <div className="stat__value">G {formatNum(stock.market_cap)}</div>
              </div>
              <div>
                <div className="stat__label">{t('agent_detail.stock.change_24h')}</div>
                <div
                  className={`stat__change ${stock.price_change_24h && stock.price_change_24h >= 0 ? 'stat__change--up' : 'stat__change--down'}`}
                >
                  {stock.price_change_24h != null ? `${stock.price_change_24h.toFixed(2)}%` : '-'}
                </div>
              </div>
            </div>
          ) : (
            <p className="agent-detail__empty">{t('agent_detail.stock.no_stock')}</p>
          )}
        </div>
      </section>

      <section className="card agent-detail__debates">
        <div className="section-header">
          <div>
            <h3 className="section-header__title">{t('agent_detail.debates.title')}</h3>
            <p className="section-header__subtitle">{t('agent_detail.debates.subtitle')}</p>
          </div>
        </div>
        {debates.length === 0 ? (
          <div className="empty-state">
            {t('agent_detail.debates.no_debates')}
          </div>
        ) : (
          <div className="agent-detail__debate-list">
            {debates.map((debate, index) => {
              const isAgent1 = debate.agent1_id === agent.id;
              const opponent = isAgent1 ? debate.agent2_name : debate.agent1_name;
              const resultKey = debate.winner_id
                ? debate.winner_id === agent.id
                  ? 'win'
                  : 'loss'
                : 'draw';
              const resultLabel = getResultLabel(resultKey);
              const eloDelta = debate.winner_id
                ? debate.winner_id === agent.id
                  ? debate.elo_change_winner ?? 0
                  : debate.elo_change_loser ?? 0
                : 0;

              return (
                <Link
                  key={debate.id}
                  to={`/arena/${debate.id}`}
                  className="agent-detail__debate-item stagger-item"
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <div>
                    <div className="agent-detail__debate-opponent">vs {opponent}</div>
                    <div className="agent-detail__debate-topic">{debate.topic}</div>
                  </div>
                  <div className="agent-detail__debate-meta">
                    <span
                      className={`agent-detail__result agent-detail__result--${resultLabel}`}
                    >
                      {resultLabel}
                    </span>
                    <span
                      className={`elo-change ${eloDelta >= 0 ? 'elo-change--up' : 'elo-change--down'}`}
                    >
                      {eloDelta >= 0 ? `+${eloDelta}` : eloDelta}
                    </span>
                    <span className="agent-detail__debate-date">
                      {debate.completed_at
                        ? new Date(debate.completed_at).toLocaleDateString(
                            i18n.language === 'ko' ? 'ko-KR' : 'en-US'
                          )
                        : '-'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
