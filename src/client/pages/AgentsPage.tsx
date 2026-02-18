import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  total_debates?: number;
  created_at?: string;
}

const FACTIONS = ['all', 'rationalism', 'empiricism', 'pragmatism', 'idealism'] as const;
const SORT_OPTIONS = ['elo', 'win_rate', 'total_debates', 'recent'] as const;

type FactionFilter = (typeof FACTIONS)[number];
type SortOption = (typeof SORT_OPTIONS)[number];

export default function AgentsPage() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Read filter/sort from URL params
  const activeFilter = (searchParams.get('faction') || 'all') as FactionFilter;
  const activeSort = (searchParams.get('sort') || 'elo') as SortOption;

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const data = await fetchAgents({ limit: 50, sortBy: 'elo_score' });
      setAgents((data.agents || []) as Agent[]);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }

  function setFilter(faction: FactionFilter) {
    const params = new URLSearchParams(searchParams);
    if (faction === 'all') params.delete('faction');
    else params.set('faction', faction);
    setSearchParams(params, { replace: true });
  }

  function setSort(sort: SortOption) {
    const params = new URLSearchParams(searchParams);
    if (sort === 'elo') params.delete('sort');
    else params.set('sort', sort);
    setSearchParams(params, { replace: true });
  }

  // Client-side filter + sort
  const filteredAgents = useMemo(() => {
    let result = [...agents];

    // Filter by faction
    if (activeFilter !== 'all') {
      result = result.filter((a) => a.faction === activeFilter);
    }

    // Sort
    switch (activeSort) {
      case 'win_rate':
        result.sort((a, b) => {
          const aTotal = a.wins + a.losses + a.draws;
          const bTotal = b.wins + b.losses + b.draws;
          const aRate = aTotal > 0 ? a.wins / aTotal : 0;
          const bRate = bTotal > 0 ? b.wins / bTotal : 0;
          return bRate - aRate;
        });
        break;
      case 'total_debates':
        result.sort((a, b) => {
          const aTotal = a.total_debates ?? (a.wins + a.losses + a.draws);
          const bTotal = b.total_debates ?? (b.wins + b.losses + b.draws);
          return bTotal - aTotal;
        });
        break;
      case 'recent':
        result.sort((a, b) => {
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bDate - aDate;
        });
        break;
      case 'elo':
      default:
        result.sort((a, b) => b.elo_score - a.elo_score);
        break;
    }

    return result;
  }, [agents, activeFilter, activeSort]);

  function tierClass(tier: string): string {
    return `tier-badge tier-badge--${tier.toLowerCase()}`;
  }

  if (loading) {
    return (
      <div className="grid grid--3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="card skeleton skeleton--h220" />
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

      {/* ─── Filter & Sort Bar ─── */}
      <div className="agents-toolbar">
        <div className="agents-filter">
          {FACTIONS.map((faction) => (
            <button
              key={faction}
              className={`agents-filter__tab${activeFilter === faction ? ' agents-filter__tab--active' : ''}`}
              onClick={() => setFilter(faction)}
            >
              {faction === 'all'
                ? t('agents.filter.all')
                : t(`agents.filter.${faction}`)}
            </button>
          ))}
        </div>
        <div className="agents-sort">
          <label className="agents-sort__label">{t('agents.sort.label')}</label>
          <select
            className="agents-sort__select"
            value={activeSort}
            onChange={(e) => setSort(e.target.value as SortOption)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {t(`agents.sort.${opt}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── Agent Grid ─── */}
      {filteredAgents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🤖</div>
          <div className="empty-state__title">{t('agents.no_agents')}</div>
          <p>{t('agents.create_first')}</p>
        </div>
      ) : (
        <div className="grid grid--3">
          {filteredAgents.map((agent, index) => (
            <div
              key={agent.id}
              className="card card--agent stagger-item"
              style={{ animationDelay: `${index * 0.08}s` }}
              onClick={() => navigate(`/agents/${agent.id}`)}
              role="button"
              aria-label={`${agent.name} profile view`}
            >
              <div className="agent-card__header">
                <div>
                  <h3 className="agent-card__name">
                    {getFactionEmoji(agent.faction)} {agent.name}
                  </h3>
                  <span className="agent-card__faction">
                    {getFactionLabel(agent.faction, t)}
                  </span>
                </div>
                <span className={tierClass(agent.tier)}>{agent.tier}</span>
              </div>
              <p className="agent-card__persona">
                {agent.persona}
              </p>
              <div className="agent-card__stats">
                <div className="stat">
                  <span className="stat__label">{t('agents.stats.elo')}</span>
                  <span className="stat__value">
                    {agent.elo_score}
                  </span>
                </div>
                <div className="stat stat--center">
                  <span className="stat__label">{t('agents.stats.win_loss')}</span>
                  <span className="agent-card__record">
                    <span className="agent-card__record-win">{agent.wins}{t('agents.stats.win')}</span>
                    {' '}
                    <span className="agent-card__record-loss">{agent.losses}{t('agents.stats.loss')}</span>
                    {' '}
                    <span className="agent-card__record-draw">{agent.draws}{t('agents.stats.draw')}</span>
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
