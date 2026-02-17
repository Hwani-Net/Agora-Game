import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchAgents } from '../api.js';
import { useAuthContext } from '../AuthContext.js';
import { getFactionLabel, getFactionEmoji } from '../utils/factions.js';

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


export default function AgentsPage() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

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
          <h2 className="section-header__title">🧬 {t('agents.title')}</h2>
          <p className="section-header__subtitle">{t('agents.subtitle')}</p>
        </div>
        {user && (
          <button className="btn btn--primary" onClick={() => navigate('/agents/create')}>
            + {t('common.create')}
          </button>
        )}
      </div>

      {/* ─── Agent Grid ─── */}
      {agents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🤖</div>
          <div className="empty-state__title">{t('agents.no_agents')}</div>
          <p>{t('agents.create_first')}</p>
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
              aria-label={`${agent.name} profile view`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: '1.075rem', fontWeight: 700 }}>
                    {getFactionEmoji(agent.faction)} {agent.name}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.825rem',
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                    }}
                  >
                    {getFactionLabel(agent.faction, t)}
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
                  <span className="stat__label">{t('agents.stats.elo')}</span>
                  <span className="stat__value" style={{ fontSize: '1.125rem' }}>
                    {agent.elo_score}
                  </span>
                </div>
                <div className="stat" style={{ textAlign: 'center' }}>
                  <span className="stat__label">{t('agents.stats.win_loss')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--success)' }}>{agent.wins}{t('agents.stats.win')}</span>
                    {' '}
                    <span style={{ color: 'var(--danger)' }}>{agent.losses}{t('agents.stats.loss')}</span>
                    {' '}
                    <span style={{ color: 'var(--text-muted)' }}>{agent.draws}{t('agents.stats.draw')}</span>
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
