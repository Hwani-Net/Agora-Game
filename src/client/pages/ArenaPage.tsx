import { useState, useEffect } from 'react';
import { fetchRecentDebates, fetchTopics, startAutoBattle } from '../api.js';
import { useAuthContext } from '../AuthContext.js';

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

interface Round {
  round: number;
  agent1_argument: string;
  agent2_argument: string;
}

export default function ArenaPage() {
  const { user } = useAuthContext();
  const [debates, setDebates] = useState<Debate[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedDebate, setSelectedDebate] = useState<Debate | null>(null);

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

  async function handleStartAutoBattle() {
    if (!user) return;
    setStarting(true);
    try {
      const result = await startAutoBattle();
      setDebates((prev) => [result as Debate, ...prev]);
      setSelectedDebate(result as Debate);
    } catch (err) {
      alert(err instanceof Error ? err.message : '배틀 시작 실패');
    } finally {
      setStarting(false);
    }
  }

  function parseRounds(rounds: unknown): { speaker: string; content: string }[] {
    try {
      const arr = typeof rounds === 'string' ? JSON.parse(rounds) : rounds;
      if (!Array.isArray(arr)) return [];
      // Convert round format to speaker/content pairs
      return arr.flatMap((r: Round) => {
        const items = [];
        if (r.agent1_argument) items.push({ speaker: 'Agent 1', content: r.agent1_argument });
        if (r.agent2_argument) items.push({ speaker: 'Agent 2', content: r.agent2_argument });
        return items;
      });
    } catch {
      return [];
    }
  }

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-header__title">⚔️ 배틀 아레나</h2>
          <p className="section-header__subtitle">AI 에이전트들의 치열한 토론을 관전하세요</p>
        </div>
        {user && (
          <button className="btn btn--primary" onClick={handleStartAutoBattle} disabled={starting}>
            {starting ? '매칭 중...' : '🎲 자동 매칭 배틀'}
          </button>
        )}
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

      {/* ─── Selected Debate Detail ─── */}
      {selectedDebate && (
        <div className="card" style={{ marginBottom: 24, border: '1px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700 }}>📜 {selectedDebate.topic}</h3>
            <button className="btn btn--ghost btn--sm" onClick={() => setSelectedDebate(null)}>✕</button>
          </div>
          <div className="debate-panel">
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--accent-primary)', marginBottom: 16 }}>
                {selectedDebate.agent1_name}
              </div>
            </div>
            <div className="debate-panel__vs">VS</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--accent-secondary)', marginBottom: 16 }}>
                {selectedDebate.agent2_name}
              </div>
            </div>
          </div>

          {parseRounds(selectedDebate.rounds).map((round, i) => (
            <div key={i} className="debate-round animate-slide-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="debate-round__speaker">
                {round.speaker === 'Agent 1' ? '🟣' : '🔵'} {round.speaker === 'Agent 1' ? selectedDebate.agent1_name : selectedDebate.agent2_name}
              </div>
              <div className="debate-round__text">{round.content}</div>
            </div>
          ))}

          {selectedDebate.winner_name && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                marginTop: 16,
                background: 'var(--accent-gradient)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: '1.125rem',
              }}
            >
              🏆 승자: {selectedDebate.winner_name}
            </div>
          )}
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
          {debates.map((d) => (
            <div
              key={d.id}
              className="card"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => setSelectedDebate(d)}
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
