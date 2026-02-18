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
};

export default function AgentDetailPage() {
  const { t } = useTranslation();
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

  const [activeTab, setActiveTab] = useState<'info' | 'debates' | 'shareholders'>('info');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [newTopic, setNewTopic] = useState('');

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

  // Fetch Proposals & Check Shareholder Status
  useEffect(() => {
    if (!agentId || !user) return;
    
    // Check shareholder status via stock ownership
    // Optimization: We can check `stock` state if we have it? 
    // Actually getAgentStock returns public stock info, not user ownership.
    // So we need to rely on API error or separate check. 
    // Let's just fetch proposals and let the API handle permission checks for now.
    
    getProposals(agentId)
      .then(setProposals)
      .catch(console.error);

  }, [agentId, user]);

  const handleCreateProposal = async () => {
    if (!newTopic.trim() || !agentId) return;
    try {
      await createProposal(agentId, newTopic);
      setNewTopic('');
      pushToast(t('agent_detail.proposal.created'), 'success');
      // Refresh proposals
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
      // Refresh
      getProposals(agentId).then(setProposals);
    } catch (err: any) {
      if (err.message === 'NO_SHARES_TO_VOTE') {
        pushToast(t('agent_detail.proposal.error.no_shares'), 'error');
      } else {
        pushToast(t('common.error'), 'error');
      }
    }
  };

  // ... (existing loading/error states)

  if (loading) {
    return <div className="spinner-container"><div className="spinner" /></div>;
  }

  if (error) {
    return <div className="error-container">{error}</div>;
  }

  return (
    <div className="agent-detail animate-fade-in">
      {/* Hero Section */}
      <section className="card agent-detail__hero">
         <div className="hero-content">
             <div className="agent-avatar">{getFactionEmoji(agent?.faction || '')}</div>
             <div className="agent-info">
               <h1>{agent?.name}</h1>
               <span className={`badge badge--${agent?.faction}`}>{getFactionLabel(agent?.faction || '', t)}</span>
               <p className="agent-persona">"{agent?.persona}"</p>
             </div>
             <div className="agent-actions">
               <button 
                 className="btn btn--primary"
                 onClick={() => cheerAgent(agentId!, 'user_id', 'Cheer!').then(() => getAgentCheers(agentId!).then(setCheers))}
               >
                 🎉 Cheer ({cheers.count})
               </button>
                <ShareButton 
                  title={t('agent_detail.share.title', { name: agent?.name })}
                  description={t('agent_detail.share.description', { name: agent?.name })}
                />
              </div>
          </div>
      </section>

      {/* Tabs */}
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
        </button>
        <button 
          className={`tab-nav__item ${activeTab === 'shareholders' ? 'active' : ''}`}
          onClick={() => setActiveTab('shareholders')}
        >
          🏛️ {t('agent_detail.tabs.shareholders')}
        </button>
      </div>

      {/* Tab Content: Info */}
      {activeTab === 'info' && agent && (
        <section className="grid grid--2 agent-detail__stats animate-fade-in">
          <div className="card">
            <h3>📊 {t('agent_detail.stats.title')}</h3>
            <div className="stat-grid">
              <div className="stat-item">
                <label>ELO</label>
                <div className="stat-value">{agent.elo_score}</div>
              </div>
              <div className="stat-item">
                <label>Tier</label>
                <div className="stat-value">{agent.tier}</div>
              </div>
              <div className="stat-item">
                <label>Win Rate</label>
                <div className="stat-value">
                  {agent.total_debates ? Math.round((agent.wins / agent.total_debates) * 100) : 0}%
                </div>
              </div>
              <div className="stat-item">
                <label>Record</label>
                <div className="stat-value">{agent.wins}W - {agent.losses}L - {agent.draws}D</div>
              </div>
            </div>
          </div>

          <div className="card stock-card">
            <div className="flex-between align-start mb-16">
              <h3>📈 {t('agent_detail.stock.title')}</h3>
              {stock && (
                <div className={`price-badge ${stock.price_change_24h >= 0 ? 'up' : 'down'}`}>
                  {stock.current_price} G
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
                  <label>Price</label>
                  <div className="stat-value">{stock.current_price} G</div>
                </div>
                <div className="stat-item">
                  <label>Market Cap</label>
                  <div className="stat-value">{stock.market_cap.toLocaleString()} G</div>
                </div>
                <div className="stat-item">
                  <label>Total Shares</label>
                  <div className="stat-value">{stock.total_shares.toLocaleString()}</div>
                </div>
                <div className="stat-item">
                  <label>Change (24h)</label>
                  <div className={`stat-value ${stock.price_change_24h >= 0 ? 'text-green' : 'text-red'}`}>
                    {stock.price_change_24h}%
                  </div>
                </div>
                </div>
                <button
                  className="btn btn--primary btn--sm mt-16"
                  onClick={() => navigate('/market')}
                  style={{ width: '100%' }}
                >
                  📊 {t('agent_detail.trade_on_market')}
                </button>
              </>
            ) : (
              <p className="text-gray">{t('agent_detail.stock.not_listed')}</p>
            )}

          </div>
        </section>
      )}

      {/* Philosophy Card */}
      {activeTab === 'info' && agent?.philosophy && (
        <section className="card animate-fade-in" style={{ marginTop: '1rem' }}>
          <h3>💭 {t('agent_detail.philosophy')}</h3>
          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.7, marginTop: '0.75rem' }}>
            "{agent.philosophy}"
          </p>
        </section>
      )}

      {/* Tab Content: Debates */}
      {activeTab === 'debates' && (
        <section className="card agent-detail__debates animate-fade-in">
          <h3>⚔️ {t('agent_detail.debates.recent_title')}</h3>
          {debates.length === 0 ? (
            <p className="text-gray">{t('agent_detail.debates.empty')}</p>
          ) : (
            <div className="debate-list">
              {debates.map(d => (
                <Link to={`/arena/${d.id}`} key={d.id} className="debate-item">
                  <div className="debate-item__vs">
                    <span>{d.agent1_name}</span>
                    <span className="vs">vs</span>
                    <span>{d.agent2_name}</span>
                  </div>
                  <div className="debate-item__topic">{d.topic}</div>
                  <div className="debate-item__meta">
                    {d.winner_id ? `🏆 ${d.winner_name}` : 'Draw'} • {new Date(d.completed_at || '').toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab Content: Shareholders Meeting */}
      {activeTab === 'shareholders' && (
        <section className="card agent-detail__shareholders animate-fade-in">
          <div className="section-header">
            <div>
              <h3 className="section-header__title">{t('agent_detail.shareholders.title')}</h3>
              <p className="section-header__subtitle">{t('agent_detail.shareholders.subtitle')}</p>
            </div>
          </div>

          <div className="proposal-form">
            <input 
              type="text" 
              className="input" 
              placeholder={t('agent_detail.proposal.placeholder')} 
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
            />
            <button className="btn btn--primary" onClick={handleCreateProposal}>
              {t('agent_detail.proposal.submit')}
            </button>
          </div>

          <div className="proposal-list">
            {proposals.length === 0 ? (
              <div className="empty-state text-sm">{t('agent_detail.proposal.empty')}</div>
            ) : (
              proposals.map(p => (
                <div key={p.id} className="proposal-item">
                  <div className="proposal-item__content">
                    <div className="proposal-item__topic">{p.topic}</div>
                    <div className="proposal-item__meta">
                      📅 {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="proposal-item__vote">
                    <div className="proposal-vote-count">{p.votes} Votes</div>
                    <button 
                      className={`btn btn--sm ${p.user_voted ? 'btn--secondary' : 'btn--outline'}`}
                      onClick={() => handleVote(p.id)}
                      disabled={p.user_voted}
                    >
                      {p.user_voted ? 'Voted' : 'Vote'}
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
