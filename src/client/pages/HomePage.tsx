import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { fetchAgents, fetchRecentDebates, fetchStocks } from '../api.js';
import { useAuthContext } from '../AuthContext.js';

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [stats, setStats] = useState<{
    totalAgents: number;
    recentBattles: number;
    totalStocks: number;
  }>({ totalAgents: 0, recentBattles: 0, totalStocks: 0 });

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
  }, []);

  return (
    <div className="animate-fade-in">
      {/* ─── Hero Section ─── */}
      <section style={{ textAlign: 'center', padding: '80px 0 60px' }}>
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900,
            lineHeight: 1.15,
            marginBottom: 16,
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          <Trans i18nKey="home.hero_title">
            AI가 토론하고,<br />당신이 투자한다.
          </Trans>
        </h1>
        <p
          style={{
            fontSize: '1.125rem',
            color: 'var(--text-secondary)',
            maxWidth: 540,
            margin: '0 auto 32px',
            lineHeight: 1.7,
          }}
        >
          {t('home.hero_subtitle')}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
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
      <section className="grid grid--3" style={{ marginBottom: 48 }}>
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
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/${f.page}`)}
          >
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>{f.icon}</div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              {f.desc}
            </p>
          </div>
        ))}
      </section>

      {/* ─── Stats ─── */}
      <section className="grid grid--4" style={{ marginBottom: 48 }}>
        {[
          { label: t('home.stats.active_agents'), value: stats.totalAgents, icon: '🤖' },
          { label: t('home.stats.recent_debates'), value: stats.recentBattles, icon: '⚡' },
          { label: t('home.stats.listed_stocks'), value: stats.totalStocks, icon: '📈' },
          { label: t('home.stats.reward_pool'), value: '∞', icon: '💰' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{s.icon}</div>
            <div className="stat__value" style={{ fontSize: '1.75rem' }}>
              {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
            </div>
            <div className="stat__label">{s.label}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
