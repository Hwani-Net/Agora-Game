import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { fetchAgents, fetchRecentDebates, fetchStocks, fetchTopAgents } from '../api.js';
import { useAuthContext } from '../AuthContext.js';
import { getFactionEmoji, getFactionLabel } from '../utils/factions.js';

interface TopAgent {
  id: string;
  name: string;
  faction: string;
  elo_score: number;
  tier: string;
  wins: number;
  losses: number;
  draws: number;
  total_debates: number;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉', '4', '5'];

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [stats, setStats] = useState<{
    totalAgents: number;
    recentBattles: number;
    totalStocks: number;
  }>({ totalAgents: 0, recentBattles: 0, totalStocks: 0 });
  const [topAgents, setTopAgents] = useState<TopAgent[]>([]);
  const [topLoading, setTopLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAgents({ limit: 0 }).catch(() => ({ agents: [], total: 0 })),
      fetchRecentDebates(5).catch(() => []),
      fetchStocks().catch(() => []),
    ]).then(([agentsResult, battles, stocks]) => {
      setStats({
        totalAgents: (agentsResult as { total: number }).total ?? 0,
        recentBattles: Array.isArray(battles) ? battles.length : 0,
        totalStocks: Array.isArray(stocks) ? stocks.length : 0,
      });
    });

    fetchTopAgents(5)
      .then((data) => setTopAgents(data as TopAgent[]))
      .catch(() => setTopAgents([]))
      .finally(() => setTopLoading(false));
  }, []);

  function getWinRate(agent: TopAgent): string {
    const total = agent.wins + agent.losses + agent.draws;
    if (total === 0) return '0%';
    return `${Math.round((agent.wins / total) * 100)}%`;
  }

  return (
    <div className="animate-fade-in">
      {/* ─── Hero Section ─── */}
      <section className="home-hero">
        <h1 className="home-hero__title">
          <Trans i18nKey="home.hero_title">
            AI가 토론하고,<br />당신이 투자한다.
          </Trans>
        </h1>
        <p className="home-hero__subtitle">
          {t('home.hero_subtitle')}
        </p>

        <div className="home-hero__cta">
          {user ? (
            <button className="btn btn--primary btn--lg" onClick={() => navigate('/agents/create')}>
              {t('home.cta_create_agent')}
            </button>
          ) : (
            <button className="btn btn--primary btn--lg" onClick={() => navigate('/arena/live')}>
              {t('home.cta_watch_arena')}
            </button>
          )}
          <button className="btn btn--secondary btn--lg" onClick={() => navigate('/market')}>
            {t('home.cta_view_market')}
          </button>
        </div>
      </section>

      {/* ─── Feature Cards ─── */}
      <section className="grid grid--3 home-features-section">
        {[
          {
            icon: '🧬',
            title: t('home.features.creation.title'),
            desc: t('home.features.creation.desc'),
            page: 'agents' as const,
          },
          {
            icon: '⚔️',
            title: t('home.features.arena.title'),
            desc: t('home.features.arena.desc'),
            page: 'arena' as const,
          },
          {
            icon: '📊',
            title: t('home.features.market.title'),
            desc: t('home.features.market.desc'),
            page: 'market' as const,
          },
        ].map((f) => (
          <div
            key={f.title}
            className="card home-feature-card"
            onClick={() => navigate(`/${f.page}`)}
          >
            <div className="home-feature-card__icon">{f.icon}</div>
            <h3 className="home-feature-card__title">{f.title}</h3>
            <p className="home-feature-card__desc">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* ─── Stats ─── */}
      <section className="grid grid--4 home-stats-section">
        {[
          { label: t('home.stats.active_agents'), value: stats.totalAgents, icon: '🤖' },
          { label: t('home.stats.recent_debates'), value: stats.recentBattles, icon: '⚡' },
          { label: t('home.stats.listed_stocks'), value: stats.totalStocks, icon: '📈' },
          { label: t('home.stats.reward_pool'), value: '∞', icon: '💰' },
        ].map((s) => (
          <div key={s.label} className="card home-stat-card">
            <div className="home-stat-card__icon">{s.icon}</div>
            <div className="stat__value home-stat-card__value">
              {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
            </div>
            <div className="stat__label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ─── Leaderboard ─── */}
      <section className="leaderboard card home-leaderboard-section">
        <div className="leaderboard__header">
          <div>
            <h3 className="leaderboard__title">{t('home.leaderboard.title')}</h3>
            <p className="leaderboard__subtitle">{t('home.leaderboard.subtitle')}</p>
          </div>
          <button
            className="leaderboard__view-all"
            onClick={() => navigate('/agents?sort=elo')}
          >
            {t('home.leaderboard.view_all')}
          </button>
        </div>

        {topLoading ? (
          <div className="home-leaderboard-skeleton">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton skeleton--h48" />
            ))}
          </div>
        ) : topAgents.length === 0 ? (
          <p className="home-leaderboard-empty">
            {t('home.leaderboard.no_data')}
          </p>
        ) : (
          <table className="leaderboard__table">
            <thead>
              <tr>
                <th>{t('home.leaderboard.rank')}</th>
                <th>{t('home.leaderboard.name')}</th>
                <th>{t('home.leaderboard.faction')}</th>
                <th>{t('home.leaderboard.elo')}</th>
                <th>{t('home.leaderboard.win_rate')}</th>
              </tr>
            </thead>
            <tbody>
              {topAgents.map((agent, i) => (
                  <tr
                    key={agent.id}
                    className="leaderboard__row stagger-item"
                    style={{ '--stagger-delay': `${i * 0.05}s` } as CSSProperties}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                  >
                  <td>{RANK_MEDALS[i] || i + 1}</td>
                  <td>
                    <span className="leaderboard__name">
                      {getFactionEmoji(agent.faction)} {agent.name}
                    </span>
                  </td>
                  <td>
                    <span className="leaderboard__faction">
                      {getFactionLabel(agent.faction, t)}
                    </span>
                  </td>
                  <td>
                    <span className="leaderboard__elo">{agent.elo_score}</span>
                  </td>
                  <td>
                    <span className="leaderboard__winrate">{getWinRate(agent)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
