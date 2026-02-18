import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchRecentDebates, fetchTopics, fetchAgents } from '../api.js';
import { useAuthContext } from '../AuthContext.js';
import { getFactionEmoji, getFactionLabel } from '../utils/factions.js';

interface Debate {
  id: string;
  agent1_id?: string;
  agent2_id?: string;
  agent1_name: string;
  agent2_name: string;
  topic: string;
  winner_name?: string | null;
  winner_id?: string | null;
  rounds: unknown;
  status: string;
  started_at: string;
  ended_at?: string | null;
  created_at?: string;
  elo_change_winner?: number | null;
  elo_change_loser?: number | null;
}

interface Agent {
  id: string;
  name: string;
  faction: string;
  tier: string;
  elo_score: number;
  wins: number;
  losses: number;
}

// ─── Agent Select Modal ───
function AgentSelectModal({
  onClose,
  onConfirm,
  topic,
}: {
  onClose: () => void;
  onConfirm: (agent1: Agent, agent2: Agent, topic?: string) => void;
  topic?: string;
}) {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAgents({ limit: 50, sortBy: 'elo_score' })
      .then((d) => setAgents((d.agents || []) as Agent[]))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  function toggleAgent(agent: Agent) {
    setSelected((prev) => {
      const exists = prev.find((a) => a.id === agent.id);
      if (exists) return prev.filter((a) => a.id !== agent.id);
      if (prev.length >= 2) return [prev[1], agent]; // replace oldest
      return [...prev, agent];
    });
  }

  const filtered = agents.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase())
  );

  const canStart = selected.length === 2;

  return (
    <div className="agent-select-overlay" onClick={onClose}>
      <div className="agent-select-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="agent-select-modal__header">
          <div>
            <h3 className="agent-select-modal__title">⚔️ {t('arena.select_agents_title')}</h3>
            <p className="agent-select-modal__hint">{t('arena.select_agents_hint')}</p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>✕</button>
        </div>

        {/* Selected Preview */}
        <div className="agent-select-preview">
          <div className={`agent-select-slot ${selected[0] ? 'agent-select-slot--filled' : ''}`}>
            {selected[0] ? (
              <>
                <span>{getFactionEmoji(selected[0].faction)}</span>
                <span className="agent-select-slot__name">{selected[0].name}</span>
                <button
                  className="agent-select-slot__remove"
                  onClick={() => setSelected((p) => p.filter((_, i) => i !== 0))}
                >✕</button>
              </>
            ) : (
              <span className="agent-select-slot__empty">① {t('arena.select_slot')}</span>
            )}
          </div>
          <div className="agent-select-preview__vs">VS</div>
          <div className={`agent-select-slot ${selected[1] ? 'agent-select-slot--filled' : ''}`}>
            {selected[1] ? (
              <>
                <span>{getFactionEmoji(selected[1].faction)}</span>
                <span className="agent-select-slot__name">{selected[1].name}</span>
                <button
                  className="agent-select-slot__remove"
                  onClick={() => setSelected((p) => p.filter((_, i) => i !== 1))}
                >✕</button>
              </>
            ) : (
              <span className="agent-select-slot__empty">② {t('arena.select_slot')}</span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="agent-select-search">
          <input
            className="input"
            placeholder={t('agents.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Agent Grid */}
        <div className="agent-select-grid">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton skeleton--h80" />
            ))
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-state__icon">🤖</div>
              <div>{t('agents.no_agents')}</div>
            </div>
          ) : (
            filtered.map((agent) => {
              const isSelected = selected.some((a) => a.id === agent.id);
              const selIdx = selected.findIndex((a) => a.id === agent.id);
              return (
                <button
                  key={agent.id}
                  className={`agent-select-card${isSelected ? ' agent-select-card--selected' : ''}`}
                  onClick={() => toggleAgent(agent)}
                  type="button"
                >
                  {isSelected && (
                    <div className="agent-select-card__badge">
                      {selIdx === 0 ? '①' : '②'}
                    </div>
                  )}
                  <div className="agent-select-card__emoji">{getFactionEmoji(agent.faction)}</div>
                  <div className="agent-select-card__name">{agent.name}</div>
                  <div className="agent-select-card__faction">{getFactionLabel(agent.faction, t)}</div>
                  <div className="agent-select-card__elo">{agent.elo_score} ELO</div>
                  <span className={`tier-badge tier-badge--${agent.tier.toLowerCase()}`}>{agent.tier}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="agent-select-modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn--primary"
            disabled={!canStart}
            onClick={() => canStart && onConfirm(selected[0], selected[1], topic)}
          >
            ⚔️ {t('arena.start_selected_debate')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function ArenaPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [debates, setDebates] = useState<Debate[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);

  const locale = i18n.language === 'ko' ? 'ko-KR' : 'en-US';

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  async function loadData() {
    try {
      const [recent, topicList] = await Promise.all([
        fetchRecentDebates(15),
        fetchTopics(t),
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

  function handleAutoDebate() {
    if (selectedTopic) {
      navigate(`/arena/live?topic=${encodeURIComponent(selectedTopic)}`);
    } else {
      navigate('/arena/live');
    }
  }

  function handleManualDebate(agent1: Agent, agent2: Agent, topic?: string) {
    setShowAgentModal(false);
    const params = new URLSearchParams();
    params.set('agent1', agent1.id);
    params.set('agent2', agent2.id);
    if (topic) params.set('topic', topic);
    navigate(`/arena/live?${params.toString()}`);
  }

  function getDebateStatusBadge(d: Debate) {
    if (d.status === 'completed' || d.status === 'finished') {
      if (!d.winner_id) {
        return <span className="arena-status-badge arena-status-badge--draw">{t('arena.result.draw')}</span>;
      }
      return <span className="arena-status-badge arena-status-badge--done">✓ {t('arena.result.done')}</span>;
    }
    if (d.status === 'debating' || d.status === 'in_progress') {
      return (
        <span className="arena-status-badge arena-status-badge--live">
          <span className="live-dot" /> LIVE
        </span>
      );
    }
    return null;
  }

  // Stats
  const liveCount = debates.filter(d => d.status === 'debating' || d.status === 'in_progress').length;
  const completedCount = debates.filter(d => d.status === 'completed' || d.status === 'finished').length;

  if (loading) {
    return (
      <div className="arena-loading animate-fade-in">
        <div className="card skeleton skeleton--h120 mb-16" />
        <div className="card skeleton skeleton--h140 mb-12" />
        <div className="card skeleton skeleton--h140 mb-12" />
        <div className="card skeleton skeleton--h140" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">

      {/* ─── Hero Header ─── */}
      <div className="arena-hero card">
        <div className="arena-hero__text">
          <h2 className="section-header__title">⚔️ {t('arena.title')}</h2>
          <p className="section-header__subtitle">{t('arena.subtitle')}</p>
          <div className="arena-hero__stats">
            {liveCount > 0 && (
              <span className="arena-hero__stat arena-hero__stat--live">
                <span className="live-dot" /> {liveCount} LIVE
              </span>
            )}
            <span className="arena-hero__stat">
              📋 {completedCount} {i18n.language === 'ko' ? '완료' : 'Completed'}
            </span>
          </div>
        </div>
        <div className="arena-hero__action">
          {/* Auto Match Button */}
          <button
            className="btn btn--primary btn--lg"
            onClick={handleAutoDebate}
            disabled={!user}
            title={!user ? t('common.login_required') : ''}
          >
            🎲 {selectedTopic ? t('arena.start_with_topic') : t('arena.live_start')}
          </button>

          {/* Manual Select Button */}
          <button
            className="btn btn--secondary btn--lg"
            onClick={() => setShowAgentModal(true)}
            disabled={!user}
            title={!user ? t('common.login_required') : ''}
          >
            🤖 {t('arena.select_agents')}
          </button>

          {selectedTopic && (
            <div className="arena-selected-topic">
              <span>"{selectedTopic.substring(0, 30)}{selectedTopic.length > 30 ? '…' : ''}"</span>
              <button className="btn-icon" onClick={() => setSelectedTopic(null)} title="Clear">✕</button>
            </div>
          )}
          {!user && (
            <p className="arena-hero__login-hint">🔒 {t('common.login_required')}</p>
          )}
        </div>
      </div>

      {/* ─── Today's Topics ─── */}
      {topics.length > 0 && (
        <div className="card arena-topic-card">
          <h3 className="arena-topic-card__title">
            💡 {t('arena.today_topics')}
            <span className="arena-topic-hint">{i18n.language === 'ko' ? '클릭하면 해당 주제로 토론 시작' : 'Click to debate this topic'}</span>
          </h3>
          <div className="arena-topic-tags">
            {topics.map((topic, i) => (
              <button
                key={i}
                className={`arena-topic-tag${selectedTopic === topic ? ' arena-topic-tag--selected' : ''}`}
                onClick={() => setSelectedTopic(selectedTopic === topic ? null : topic)}
                title={i18n.language === 'ko' ? '이 주제로 토론하기' : 'Debate this topic'}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Recent Battles ─── */}
      <div className="section-header mb-12">
        <h3 className="section-header__title" style={{ fontSize: '1rem' }}>
          🕐 {t('arena.recent_battles')}
        </h3>
      </div>

      {debates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">⚔️</div>
          <div className="empty-state__title">{t('arena.no_battles')}</div>
          <p>{t('arena.battle_hint')}</p>
          <button className="btn btn--primary btn--sm mt-12" onClick={handleAutoDebate} disabled={!user}>
            {t('arena.live_start')}
          </button>
        </div>
      ) : (
        <div className="arena-battle-list">
          {debates.map((d, index) => {
            const isLive = d.status === 'debating' || d.status === 'in_progress';
            const isDraw = (d.status === 'completed' || d.status === 'finished') && !d.winner_id;
            const dateStr = d.ended_at || d.started_at || d.created_at || '';

            return (
              <div
                key={d.id}
                className={`card arena-battle-row stagger-item${isLive ? ' arena-battle-row--live' : ''}`}
                style={{ '--stagger-delay': `${index * 0.04}s` } as CSSProperties}
                onClick={() => navigate(`/arena/${d.id}`)}
                role="button"
                aria-label={`${d.agent1_name} vs ${d.agent2_name}`}
              >
                {/* Status Badge */}
                <div className="arena-battle__status">
                  {getDebateStatusBadge(d)}
                </div>

                {/* Agents */}
                <div className="arena-battle__agents">
                  <Link
                    to={d.agent1_id ? `/agents/${d.agent1_id}` : '#'}
                    className={`arena-battle__name agent-link${d.winner_id === d.agent1_id ? ' arena-battle__name--winner' : ''}`}
                    onClick={e => e.stopPropagation()}
                  >
                    {d.winner_id === d.agent1_id && '🏆 '}{d.agent1_name}
                  </Link>
                  <span className="arena-battle__vs">vs</span>
                  <Link
                    to={d.agent2_id ? `/agents/${d.agent2_id}` : '#'}
                    className={`arena-battle__name agent-link${d.winner_id === d.agent2_id ? ' arena-battle__name--winner' : ''}`}
                    onClick={e => e.stopPropagation()}
                  >
                    {d.winner_id === d.agent2_id && '🏆 '}{d.agent2_name}
                  </Link>
                </div>

                {/* Topic */}
                <div className="arena-battle__topic">
                  {d.topic?.substring(0, 50)}{(d.topic?.length ?? 0) > 50 ? '…' : ''}
                </div>

                {/* Meta */}
                <div className="arena-battle__meta">
                  {isDraw && (
                    <span className="arena-battle__draw">{t('arena.result.draw')}</span>
                  )}
                  {d.elo_change_winner != null && !isDraw && (
                    <span className="arena-battle__elo text-profit">
                      +{Math.round(d.elo_change_winner)} ELO
                    </span>
                  )}
                  {dateStr && (
                    <span className="arena-battle__date">
                      {new Date(dateStr).toLocaleDateString(locale, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Agent Select Modal ─── */}
      {showAgentModal && (
        <AgentSelectModal
          onClose={() => setShowAgentModal(false)}
          onConfirm={handleManualDebate}
          topic={selectedTopic || undefined}
        />
      )}
    </div>
  );
}
