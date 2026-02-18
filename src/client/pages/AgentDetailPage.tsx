import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  getAgentById, getAgentDebates, getAgentStock, getAgentCheers, cheerAgent,
  getProposals, createProposal, voteProposal, type Proposal,
  fetchStockHistory
} from '../api.js';
import StockHistoryChart from '../components/StockHistoryChart.js';
import { getFactionLabel, getFactionEmoji } from '../utils/factions.js';
import { useToast } from '../ToastContext.js';
import { useAuthContext } from '../AuthContext.js';
import ShareButton from '../components/ShareButton.js';

type Agent = {
  id: string;
  name: string;
  persona: string;
  philosophy?: string | null;
  faction: string;
  elo_score: number;
  tier: string;
  wins: number;
  losses: number;
  draws: number;
  total_debates?: number | null;
  win_rate?: number | null;
};

type Debate = {
  id: string;
  topic: string;
  agent1_id: string;
  agent2_id: string;
  agent1_name: string;
  agent2_name: string;
  winner_id?: string | null;
  winner_name?: string | null;
  elo_change_winner?: number | null;
  elo_change_loser?: number | null;
  completed_at?: string | null;
  ended_at?: string | null;
};

export default function AgentDetailPage() {
  const { t, i18n } = useTranslation();
  const { agentId } = useParams();
  const { pushToast } = useToast();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [debates, setDebates] = useState<Debate[]>([]);
  const [stock, setStock] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [cheers, setCheers] = useState({ count: 0, recent: [] as any[] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cheerLoading, setCheerLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'info' | 'debates' | 'shareholders'>('info');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [newTopic, setNewTopic] = useState('');

  const locale = i18n.language === 'ko' ? 'ko-KR' : 'en-US';
  const fmtDate = (ts: string) =>
    new Date(ts).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });

  // Fetch Agent Data
  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    Promise.all([
      getAgentById(agentId),
      getAgentDebates(agentId),
      getAgentStock(agentId),
      getAgentCheers(agentId)
    ]).then(([agentData, debatesData, stockData, cheersData]) => {
      setAgent(agentData);
      setDebates(debatesData);
      setStock(stockData);
      setCheers(cheersData);
      
      if (stockData?.id) {
        fetchStockHistory(stockData.id).then(setHistory).catch(console.error);
      }
      
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setError(t('common.error'));
      setLoading(false);
    });
  }, [agentId, t]);

  // Fetch Proposals
  useEffect(() => {
    if (!agentId || !user) return;
    getProposals(agentId)
      .then(setProposals)
      .catch(console.error);
  }, [agentId, user]);

  const handleCheer = async () => {
    if (!user || !agentId || cheerLoading) return;
    if (!user.id) {
      pushToast(t('agent_detail.cheer_login'), 'error');
      return;
    }
    setCheerLoading(true);
    try {
      await cheerAgent(agentId, user.id, 'Cheer!');
      const updated = await getAgentCheers(agentId);
      setCheers(updated);
      pushToast(t('agent_detail.cheer_sent'), 'success');
    } catch {
      pushToast(t('common.error'), 'error');
    } finally {
      setCheerLoading(false);
    }
  };

  const handleCreateProposal = async () => {
    if (!newTopic.trim() || !agentId) return;
    try {
      await createProposal(agentId, newTopic);
      setNewTopic('');
      pushToast(t('agent_detail.proposal.created'), 'success');
      getProposals(agentId).then(setProposals);
    } catch (err: any) {
      if (err.message === 'MUST_BE_SHAREHOLDER') {
        pushToast(t('agent_detail.proposal.error.shareholder_only'), 'error');
      } else {
        pushToast(t('common.error'), 'error');
      }
    }
  };

  const handleVote = async (proposalId: string) => {
    if (!agentId) return;
    try {
      await voteProposal(proposalId, agentId);
      pushToast(t('agent_detail.proposal.voted'), 'success');
      getProposals(agentId).then(setProposals);
    } catch (err: any) {
      if (err.message === 'NO_SHARES_TO_VOTE') {
        pushToast(t('agent_detail.proposal.error.no_shares'), 'error');
      } else {
        pushToast(t('common.error'), 'error');
      }
    }
  };

  if (loading) {
    return <div className="spinner-container"><div className="spinner" /></div>;
  }

  if (error || !agent) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-state__icon">🤖</div>
        <div className="empty-state__title">{t('agent_detail.not_found')}</div>
        <p>{t('agent_detail.not_found_desc')}</p>
        <button className="btn btn--primary btn--sm mt-12" onClick={() => navigate('/agents')}>
          ← {t('nav.agents')}
        </button>
      </div>
    );
  }

  const winRate = agent.total_debates
    ? Math.round((agent.wins / agent.total_debates) * 100)
    : (agent.win_rate ? Math.round(agent.win_rate * 100) : 0);

  return (
    <div className="agent-detail animate-fade-in">

      {/* ─── Hero Section ─── */}
      <section className="card agent-detail__hero">
        <div className="hero-content">
          <div className="agent-avatar">{getFactionEmoji(agent.faction)}</div>
          <div className="agent-info">
            <h1>{agent.name}</h1>
            <span className={`badge badge--${agent.faction}`}>{getFactionLabel(agent.faction, t)}</span>
            <p className="agent-persona">"{agent.persona}"</p>
            {agent.philosophy && agent.philosophy !== agent.persona && (
              <p className="agent-philosophy">💭 {agent.philosophy}</p>
            )}
          </div>
          <div className="agent-actions">
            <button
              className={`btn btn--primary ${cheerLoading ? 'btn--loading' : ''}`}
              onClick={handleCheer}
              disabled={cheerLoading || !user}
              title={!user ? t('agent_detail.cheer_login') : t('agent_detail.cheer_action')}
            >
              🎉 {t('agent_detail.cheer_label')} ({cheers.count})
            </button>
            <ShareButton
              title={t('agent_detail.share.title', { name: agent.name })}
              description={t('agent_detail.share.description', { name: agent.name })}
            />
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="agent-quick-stats">
          <div className="agent-quick-stat">
            <span className="agent-quick-stat__label">ELO</span>
            <span className="agent-quick-stat__value">{Math.round(agent.elo_score)}</span>
          </div>
          <div className="agent-quick-stat">
            <span className="agent-quick-stat__label">{t('agent_detail.record.win_rate')}</span>
            <span className="agent-quick-stat__value">{winRate}%</span>
          </div>
          <div className="agent-quick-stat">
            <span className="agent-quick-stat__label">{t('agent_detail.record.total')}</span>
            <span className="agent-quick-stat__value">{agent.total_debates ?? (agent.wins + agent.losses + agent.draws)}</span>
          </div>
          <div className="agent-quick-stat">
            <span className="agent-quick-stat__label">{i18n.language === 'ko' ? '전적' : 'Record'}</span>
            <span className="agent-quick-stat__value">
              <span className="text-profit">{agent.wins}W</span>
              {' '}<span style={{ color: 'var(--text-secondary)' }}>{agent.losses}L</span>
              {' '}<span style={{ color: 'var(--text-secondary)' }}>{agent.draws}D</span>
            </span>
          </div>
          {stock && (
            <div className="agent-quick-stat">
              <span className="agent-quick-stat__label">{t('agent_detail.stock.price')}</span>
              <span className={`agent-quick-stat__value ${stock.price_change_24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                {stock.current_price} G
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ─── Tabs ─── */}
      <div className="tab-nav">
        <button
          className={`tab-nav__item ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          ℹ️ {t('agent_detail.tabs.info')}
        </button>
        <button
          className={`tab-nav__item ${activeTab === 'debates' ? 'active' : ''}`}
          onClick={() => setActiveTab('debates')}
        >
          ⚔️ {t('agent_detail.tabs.debates')}
          {debates.length > 0 && <span className="tab-count">{debates.length}</span>}
        </button>
        <button
          className={`tab-nav__item ${activeTab === 'shareholders' ? 'active' : ''}`}
          onClick={() => setActiveTab('shareholders')}
        >
          🏛️ {t('agent_detail.tabs.shareholders')}
        </button>
      </div>

      {/* ─── Tab: Info ─── */}
      {activeTab === 'info' && (
        <div className="animate-fade-in">
          <section className="grid grid--2 agent-detail__stats">
            {/* Stats Card */}
            <div className="card">
              <h3>📊 {t('agent_detail.stats.title')}</h3>
              <div className="stat-grid">
                <div className="stat-item">
                  <label>ELO</label>
                  <div className="stat-value">{Math.round(agent.elo_score)}</div>
                </div>
                <div className="stat-item">
                  <label>Tier</label>
                  <div className="stat-value">{agent.tier}</div>
                </div>
                <div className="stat-item">
                  <label>{t('agent_detail.record.win_rate')}</label>
                  <div className="stat-value">{winRate}%</div>
                </div>
                <div className="stat-item">
                  <label>{t('agent_detail.record.total')}</label>
                  <div className="stat-value">
                    {t('agent_detail.record.format', {
                      wins: agent.wins,
                      losses: agent.losses,
                      draws: agent.draws,
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Stock Card */}
            <div className="card stock-card">
              <div className="flex-between align-start mb-16">
                <h3>📈 {t('agent_detail.stock.title')}</h3>
                {stock && (
                  <div className={`price-badge ${stock.price_change_24h >= 0 ? 'up' : 'down'}`}>
                    {stock.price_change_24h >= 0 ? '▲' : '▼'} {Math.abs(stock.price_change_24h).toFixed(1)}%
                  </div>
                )}
              </div>

              {stock ? (
                <>
                  <div className="chart-container mb-16">
                    <StockHistoryChart data={history} height={180} />
                  </div>
                  <div className="stat-grid">
                    <div className="stat-item">
                      <label>{t('agent_detail.stock.price')}</label>
                      <div className="stat-value">{stock.current_price.toLocaleString()} G</div>
                    </div>
                    <div className="stat-item">
                      <label>{t('agent_detail.stock.market_cap')}</label>
                      <div className="stat-value">{stock.market_cap.toLocaleString()} G</div>
                    </div>
                    <div className="stat-item">
                      <label>{i18n.language === 'ko' ? '총 주식' : 'Total Shares'}</label>
                      <div className="stat-value">{stock.total_shares.toLocaleString()}</div>
                    </div>
                    <div className="stat-item">
                      <label>{t('agent_detail.stock.change_24h')}</label>
                      <div className={`stat-value ${stock.price_change_24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {stock.price_change_24h >= 0 ? '+' : ''}{stock.price_change_24h}%
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn--primary btn--sm mt-16"
                    onClick={() => navigate(`/market?agent=${agentId}`)}
                    style={{ width: '100%' }}
                  >
                    📊 {t('agent_detail.trade_on_market')}
                  </button>
                </>
              ) : (
                <div className="empty-state p-y-24">
                  <p>{t('agent_detail.stock.not_listed')}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ─── Tab: Debates ─── */}
      {activeTab === 'debates' && (
        <section className="card agent-detail__debates animate-fade-in">
          <div className="section-header mb-16">
            <h3 className="section-header__title">⚔️ {t('agent_detail.debates.title')}</h3>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('agent_detail.debates.subtitle')}
            </span>
          </div>
          {debates.length === 0 ? (
            <div className="empty-state p-y-24">
              <p>{t('agent_detail.debates.no_debates')}</p>
            </div>
          ) : (
            <div className="debate-list">
              {debates.map(d => {
                const isWinner = d.winner_id === agentId;
                const isDraw = !d.winner_id;
                const resultKey = isDraw ? 'draw' : isWinner ? 'win' : 'loss';
                const eloChange = isWinner ? d.elo_change_winner : d.elo_change_loser;
                const dateStr = d.ended_at || d.completed_at;

                return (
                  <Link to={`/arena/${d.id}`} key={d.id} className="debate-item">
                    <div className="debate-item__result">
                      <span className={`debate-result-badge debate-result-badge--${resultKey}`}>
                        {t(`agent_detail.debates.result.${resultKey}`)}
                      </span>
                    </div>
                    <div className="debate-item__main">
                      <div className="debate-item__vs">
                        <span className={d.agent1_id === agentId ? 'text-bold' : ''}>{d.agent1_name}</span>
                        <span className="vs">vs</span>
                        <span className={d.agent2_id === agentId ? 'text-bold' : ''}>{d.agent2_name}</span>
                      </div>
                      <div className="debate-item__topic">{d.topic}</div>
                    </div>
                    <div className="debate-item__meta">
                      {eloChange != null && (
                        <span className={`elo-change ${eloChange >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {eloChange >= 0 ? '+' : ''}{Math.round(eloChange)} ELO
                        </span>
                      )}
                      {dateStr && (
                        <span className="text-sm-secondary">{fmtDate(dateStr)}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ─── Tab: Shareholders ─── */}
      {activeTab === 'shareholders' && (
        <section className="card agent-detail__shareholders animate-fade-in">
          <div className="section-header">
            <div>
              <h3 className="section-header__title">{t('agent_detail.shareholders.title')}</h3>
              <p className="section-header__subtitle">{t('agent_detail.shareholders.subtitle')}</p>
            </div>
          </div>

          {user ? (
            <div className="proposal-form">
              <input
                type="text"
                className="input"
                placeholder={t('agent_detail.proposal.placeholder')}
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProposal()}
              />
              <button className="btn btn--primary" onClick={handleCreateProposal} disabled={!newTopic.trim()}>
                {t('agent_detail.proposal.submit')}
              </button>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              🔒 {t('common.login_required')}
            </p>
          )}

          <div className="proposal-list">
            {proposals.length === 0 ? (
              <div className="empty-state text-sm">{t('agent_detail.proposal.empty')}</div>
            ) : (
              proposals.map(p => (
                <div key={p.id} className="proposal-item">
                  <div className="proposal-item__content">
                    <div className="proposal-item__topic">{p.topic}</div>
                    <div className="proposal-item__meta">
                      📅 {new Date(p.created_at).toLocaleDateString(locale)}
                    </div>
                  </div>
                  <div className="proposal-item__vote">
                    <div className="proposal-vote-count">{p.votes} {i18n.language === 'ko' ? '표' : 'Votes'}</div>
                    <button
                      className={`btn btn--sm ${p.user_voted ? 'btn--secondary' : 'btn--outline'}`}
                      onClick={() => handleVote(p.id)}
                      disabled={p.user_voted || !user}
                    >
                      {p.user_voted
                        ? (i18n.language === 'ko' ? '투표함' : 'Voted')
                        : (i18n.language === 'ko' ? '투표' : 'Vote')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
