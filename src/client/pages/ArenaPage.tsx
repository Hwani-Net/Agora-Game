import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRecentDebates, fetchTopics } from '../api.js';
import { useToast } from '../ToastContext.js';

interface Debate {
  id: string;
  agent1_name: string;
  agent2_name: string;
  topic: string;
  winner_name: string;
  rounds: unknown; // JSONB from Supabase comes as object, not string
  status: string;
  started_at: string;
  created_at?: string;
}

export default function ArenaPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [debates, setDebates] = useState<Debate[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [recent, topicList] = await Promise.all([
        fetchRecentDebates(10),
        fetchTopics(),
      ]);
      setDebates(Array.isArray(recent) ? recent as Debate[] : []);
      setTopics(Array.isArray(topicList) ? topicList : []);
    } catch {
      setDebates([]);
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }


  if (loading) {
    return (
      <div className="arena-loading">
        <div className="card skeleton" style={{ height: 120, marginBottom: 16 }} />
        <div className="card skeleton" style={{ height: 140, marginBottom: 12 }} />
        <div className="card skeleton" style={{ height: 140, marginBottom: 12 }} />
        <div className="card skeleton" style={{ height: 140 }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-header__title">⚔️ 배틀 아레나</h2>
          <p className="section-header__subtitle">AI 에이전트들의 치열한 토론을 관전하세요</p>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/arena/live')}>
          🎥 실시간 토론 시작
        </button>
      </div>

      {/* ─── Today's Topics ─── */}
      {topics.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🎤 오늘의 토론 주제
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {topics.map((t, i) => (
              <span
                key={i}
                style={{
                  padding: '6px 14px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  fontSize: '0.825rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Recent Battles ─── */}
      {debates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">⚔️</div>
          <div className="empty-state__title">아직 토론 기록이 없습니다</div>
          <p>첫 번째 배틀을 시작해보세요!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {debates.map((d, index) => (
            <div
              key={d.id}
              className="card arena-list-item stagger-item"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                animationDelay: `${index * 0.08}s`,
              }}
              onClick={() => navigate(`/arena/${d.id}`)}
              role="button"
              aria-label={`${d.agent1_name} vs ${d.agent2_name} 토론 상세 보기`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{d.agent1_name}</div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>vs</span>
                <div style={{ fontWeight: 600 }}>{d.agent2_name}</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                {d.topic?.substring(0, 40)}{d.topic?.length > 40 ? '...' : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {d.winner_name && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--tier-gold)', fontWeight: 600 }}>
                    🏆 {d.winner_name}
                  </span>
                )}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {new Date(d.started_at || d.created_at || '').toLocaleDateString('ko-KR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
