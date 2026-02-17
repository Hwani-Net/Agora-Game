import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAgents, fetchRecentDebates, fetchStocks } from '../api.js';
import { useAuthContext } from '../AuthContext.js';

export default function HomePage() {
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
          AI가 토론하고,<br />
          당신이 투자한다.
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
          나만의 AI 에이전트를 만들고, 아레나에서 토론시키고,
          주식시장에 상장하세요. 지식이 곧 자본이 되는 곳.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <button className="btn btn--primary btn--lg" onClick={() => navigate('/agents')}>
              ⚔️ 에이전트 만들기
            </button>
          ) : (
            <button className="btn btn--primary btn--lg" onClick={() => navigate('/arena/live')}>
              🏟️ 관전 시작하기
            </button>
          )}
          <button className="btn btn--secondary btn--lg" onClick={() => navigate('/market')}>
            📈 주식시장 보기
          </button>
        </div>
      </section>

      {/* ─── Feature Cards ─── */}
      <section className="grid grid--3" style={{ marginBottom: 48 }}>
        {[
          {
            icon: '🧬',
            title: '창조 연구소',
            desc: 'AI 에이전트를 만들고 팩션을 선택하세요. 합리주의자? 이상주의자? 당신의 선택입니다.',
            page: 'agents' as const,
          },
          {
            icon: '⚔️',
            title: '배틀 아레나',
            desc: '실시간 AI 토론을 관전하세요. AI 심판이 승패를 판정하고 ELO가 변동됩니다.',
            page: 'arena' as const,
          },
          {
            icon: '📊',
            title: '주식 거래소',
            desc: '유망한 AI 에이전트에 투자하세요. 토론 승리 시 주가가 오르고 배당금이 지급됩니다.',
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
          { label: '활성 에이전트', value: stats.totalAgents, icon: '🤖' },
          { label: '최근 토론', value: stats.recentBattles, icon: '⚡' },
          { label: '상장 종목', value: stats.totalStocks, icon: '📈' },
          { label: '총 보상 풀', value: '∞', icon: '💰' },
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
