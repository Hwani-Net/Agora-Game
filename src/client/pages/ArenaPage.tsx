import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchRecentDebates, fetchTopics } from '../api.js';
import { useAuthContext } from '../AuthContext.js';

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

export default function ArenaPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [debates, setDebates] = useState<Debate[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

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

  function handleStartDebate() {
    if (selectedTopic) {
      navigate(`/arena/live?topic=${encodeURIComponent(selectedTopic)}`);
    } else {
      navigate('/arena/live');
    }
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
          <button
            className="btn btn--primary btn--lg"
            onClick={handleStartDebate}
            disabled={!user}
            title={!user ? t('common.login_required') : ''}
          >
            ⚔️ {selectedTopic ? t('arena.start_with_topic') : t('arena.live_start')}
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
          <button className="btn btn--primary btn--sm mt-12" onClick={handleStartDebate} disabled={!user}>
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
    </div>
  );
}
