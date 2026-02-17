import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchRecentDebates, fetchTopics } from '../api.js';

interface Debate {
  id: string;
  agent1_name: string;
  agent2_name: string;
  topic: string;
  winner_name: string;
  rounds: unknown;
  status: string;
  started_at: string;
  created_at?: string;
}

export default function ArenaPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [debates, setDebates] = useState<Debate[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  async function loadData() {
    try {
      const [recent, topicList] = await Promise.all([
        fetchRecentDebates(10),
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
          <h2 className="section-header__title">⚔️ {t('arena.title')}</h2>
          <p className="section-header__subtitle">{t('arena.subtitle')}</p>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/arena/live')}>
          {t('arena.live_start')}
        </button>
      </div>

      {/* ─── Today's Topics ─── */}
      {topics.length > 0 && (
        <div className="card arena-topic-card">
          <h3 className="arena-topic-card__title">
            {t('arena.today_topics')}
          </h3>
          <div className="arena-topic-tags">
            {topics.map((t, i) => (
              <span key={i} className="arena-topic-tag">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Recent Battles ─── */}
      {debates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">⚔️</div>
          <div className="empty-state__title">{t('arena.no_battles')}</div>
          <p>{t('arena.battle_hint')}</p>
        </div>
      ) : (
        <div className="arena-battle-list">
          {debates.map((d, index) => (
            <div
              key={d.id}
              className="card arena-battle-row stagger-item"
              style={{ animationDelay: `${index * 0.08}s` }}
              onClick={() => navigate(`/arena/${d.id}`)}
              role="button"
              aria-label={`${d.agent1_name} vs ${d.agent2_name} details view`}
            >
              <div className="arena-battle__agents">
                <div className="arena-battle__name">{d.agent1_name}</div>
                <span className="arena-battle__vs">vs</span>
                <div className="arena-battle__name">{d.agent2_name}</div>
              </div>
              <div className="arena-battle__topic">
                {d.topic?.substring(0, 40)}{d.topic?.length > 40 ? '...' : ''}
              </div>
              <div className="arena-battle__meta">
                {d.winner_name && (
                  <span className="arena-battle__winner">
                    🏆 {d.winner_name}
                  </span>
                )}
                <span className="arena-battle__date">
                  {new Date(d.started_at || d.created_at || '').toLocaleDateString(
                    i18n.language === 'ko' ? 'ko-KR' : 'en-US'
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
