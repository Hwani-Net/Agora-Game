import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAgents, createAgent } from '../api.js';
import { useAuthContext } from '../AuthContext.js';
import { useToast } from '../ToastContext.js';

interface Agent {
  id: string;
  name: string;
  persona: string;
  faction: string;
  elo_score: number;
  tier: string;
  wins: number;
  losses: number;
  draws: number;
}

const FACTION_EMOJI: Record<string, string> = {
  '합리주의': '🧠',
  '경험주의': '🔬',
  '실용주의': '⚙️',
  '이상주의': '✨',
};

export default function AgentsPage() {
  const { user } = useAuthContext();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', persona: '', faction: '합리주의' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const data = await fetchAgents({ limit: 20, sortBy: 'elo_score' });
      setAgents((data.agents || []) as Agent[]);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.persona.trim()) {
      setError('이름과 성격을 입력해주세요.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await createAgent(form);
      setShowCreate(false);
      setForm({ name: '', persona: '', faction: '합리주의' });
      loadAgents();
    } catch (err) {
      const message = err instanceof Error ? err.message : '에이전트 생성에 실패했습니다.';
      setError(message);
      pushToast(message, 'error');
    } finally {
      setCreating(false);
    }
  }

  function tierClass(tier: string): string {
    return `tier-badge tier-badge--${tier.toLowerCase()}`;
  }

  if (loading) {
    return (
      <div className="grid grid--3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="card skeleton" style={{ height: 220 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-header__title">🧬 에이전트 갤러리</h2>
          <p className="section-header__subtitle">AI 토론 챔피언들을 만나보세요</p>
        </div>
        {user && (
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
            + 에이전트 생성
          </button>
        )}
      </div>

      {/* ─── Create Modal ─── */}
      {showCreate && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, fontWeight: 700 }}>새 에이전트 생성</h3>
          {error && (
            <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: '0.875rem' }}>
              ⚠️ {error}
            </div>
          )}
          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="label">이름</label>
              <input
                className="input"
                placeholder="예: 소크라테스 2.0"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">성격 / 페르소나</label>
              <textarea
                className="input input--textarea"
                placeholder="이 에이전트의 토론 스타일과 철학을 설명해주세요..."
                value={form.persona}
                onChange={(e) => setForm({ ...form, persona: e.target.value })}
              />
            </div>
            <div>
              <label className="label">팩션</label>
              <select
                className="input"
                value={form.faction}
                onChange={(e) => setForm({ ...form, faction: e.target.value })}
              >
                <option value="합리주의">🧠 합리주의</option>
                <option value="경험주의">🔬 경험주의</option>
                <option value="실용주의">⚙️ 실용주의</option>
                <option value="이상주의">✨ 이상주의</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" onClick={handleCreate} disabled={creating}>
              {creating ? '생성 중...' : '🧬 에이전트 생성'}
            </button>
            <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* ─── Agent Grid ─── */}
      {agents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🤖</div>
          <div className="empty-state__title">아직 에이전트가 없습니다</div>
          <p>첫 번째 AI 에이전트를 만들어보세요!</p>
        </div>
      ) : (
        <div className="grid grid--3">
          {agents.map((agent, index) => (
            <div
              key={agent.id}
              className="card card--agent stagger-item"
              style={{ cursor: 'pointer', animationDelay: `${index * 0.08}s` }}
              onClick={() => navigate(`/agents/${agent.id}`)}
              role="button"
              aria-label={`${agent.name} 프로필 보기`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: '1.075rem', fontWeight: 700 }}>
                    {FACTION_EMOJI[agent.faction] || '🤖'} {agent.name}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                    }}
                  >
                    {agent.faction}
                  </span>
                </div>
                <span className={tierClass(agent.tier)}>{agent.tier}</span>
              </div>
              <p
                style={{
                  fontSize: '0.825rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: 16,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {agent.persona}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="stat">
                  <span className="stat__label">ELO</span>
                  <span className="stat__value" style={{ fontSize: '1.125rem' }}>
                    {agent.elo_score}
                  </span>
                </div>
                <div className="stat" style={{ textAlign: 'center' }}>
                  <span className="stat__label">전적</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--success)' }}>{agent.wins}W</span>
                    {' '}
                    <span style={{ color: 'var(--danger)' }}>{agent.losses}L</span>
                    {' '}
                    <span style={{ color: 'var(--text-muted)' }}>{agent.draws}D</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
