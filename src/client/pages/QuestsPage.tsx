import { useState, useEffect } from 'react';
import { api } from '../api.js';

interface Quest {
  id: string;
  type: string;
  title: string;
  description: string;
  reward_gold: number;
  status: string;
  created_at: string;
}

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'daily' | 'bounty'>('all');

  useEffect(() => {
    loadQuests();
  }, [filter]);

  async function loadQuests() {
    setLoading(true);
    try {
      const params = filter === 'all' ? '' : `?type=${filter}`;
      const data = await api.get<Quest[]>(`/quests${params}`);
      setQuests(Array.isArray(data) ? data : []);
    } catch {
      setQuests([]);
    } finally {
      setLoading(false);
    }
  }

  function statusBadge(status: string) {
    const colors: Record<string, { bg: string; text: string }> = {
      active: { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--success)' },
      closed: { bg: 'rgba(107, 114, 128, 0.1)', text: 'var(--text-muted)' },
      completed: { bg: 'rgba(99, 102, 241, 0.1)', text: 'var(--accent-primary)' },
    };
    const style = colors[status] || colors.active;
    return (
      <span
        style={{
          padding: '3px 10px',
          borderRadius: 'var(--radius-xl)',
          fontSize: '0.7rem',
          fontWeight: 600,
          background: style.bg,
          color: style.text,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {status}
      </span>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-header__title">📋 퀘스트 보드</h2>
          <p className="section-header__subtitle">퀘스트를 완료하고 골드를 획득하세요</p>
        </div>
      </div>

      {/* ─── Filter ─── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { key: 'all' as const, label: '전체' },
          { key: 'daily' as const, label: '🎯 일일 퀘스트' },
          { key: 'bounty' as const, label: '💰 현상금 퀘스트' },
        ].map((f) => (
          <button
            key={f.key}
            className={`btn ${filter === f.key ? 'btn--primary' : 'btn--secondary'} btn--sm`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : quests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📋</div>
          <div className="empty-state__title">퀘스트가 없습니다</div>
          <p>새로운 퀘스트가 매일 생성됩니다!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {quests.map((quest) => (
            <div key={quest.id} className="card" style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.25rem' }}>{quest.type === 'daily' ? '🎯' : '💰'}</span>
                  <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{quest.title}</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {statusBadge(quest.status)}
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: 'var(--tier-gold)',
                      fontSize: '0.875rem',
                    }}
                  >
                    {quest.reward_gold.toLocaleString()} G
                  </span>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                {quest.description}
              </p>
              <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {new Date(quest.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
