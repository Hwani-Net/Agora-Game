import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../AuthContext.js';
import {
  fetchPortfolio,
  fetchRecentTrades,
  fetchGoldHistory,
  fetchUsageStats,
  fetchPortfolioHistory,
  capturePortfolioSnapshot,
  fetchAgents,
  type PortfolioItem,
  type TradeRecord,
  type GoldTransaction,
} from '../api.js';
import PortfolioChart from '../components/PortfolioChart.js';
import { getFactionEmoji } from '../utils/factions.js';

type TradeTab = 'stock' | 'gold';

interface UsageStats {
  debates_today: number;
  trades_today: number;
  agents_count?: number;
}

interface AgentRow {
  id: string;
  name: string;
  faction: string;
  elo_score: number;
  win_rate: number;
  total_debates: number;
  persona: string;
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuthContext();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [goldTxns, setGoldTxns] = useState<GoldTransaction[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [myAgents, setMyAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeTab, setTradeTab] = useState<TradeTab>('stock');
  const [tradeLimit, setTradeLimit] = useState(10);
  const [goldLimit, setGoldLimit] = useState(10);
  const [usage, setUsage] = useState<UsageStats | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetchPortfolio(),
      fetchRecentTrades(tradeLimit),
      fetchGoldHistory(goldLimit),
      fetchUsageStats(),
      fetchPortfolioHistory(),
      capturePortfolioSnapshot(), // fire & forget
      fetchAgents({ ownerId: user.id, limit: 20, sortBy: 'elo_score' }),
    ])
      .then(([p, tr, gl, us, ph, , ag]) => {
        setPortfolio(p);
        setTrades(tr);
        setGoldTxns(gl);
        setUsage(us as UsageStats);
        setHistory(ph as any[]);
        setMyAgents(((ag as { agents: unknown[] }).agents as AgentRow[]) || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tradeLimit, goldLimit]);

  const locale = i18n.language === 'ko' ? 'ko-KR' : 'en-US';
  const fmt = (n: number) => n.toLocaleString(locale);
  const fmtDate = (ts: string) =>
    new Date(ts).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (authLoading) {
    return (
      <div className="profile-page animate-fade-in">
        <div className="card skeleton skeleton--h200 mb-24" />
        <div className="grid grid--2">
          <div className="card skeleton skeleton--h160" />
          <div className="card skeleton skeleton--h160" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-state__icon">🔒</div>
        <div className="empty-state__title">{t('profile.login_required')}</div>
        <p>{t('profile.login_required_desc')}</p>
      </div>
    );
  }

  const portfolioValue = portfolio.reduce((s, p) => s + p.total_value, 0);
  const totalAssets = user.gold_balance + portfolioValue;
  const totalProfit = portfolio.reduce((s, p) => s + p.profit, 0);
  const profitPct = portfolioValue > 0 ? (totalProfit / (portfolioValue - totalProfit)) * 100 : 0;

  // Avatar initials
  const initials = (user.name || '?').slice(0, 2).toUpperCase();

  return (
    <div className="profile-page animate-fade-in">

      {/* ─── Hero Header ─── */}
      <section className="profile-hero card">
        <div className="profile-hero__avatar">
          {initials}
        </div>
        <div className="profile-hero__info">
          <div className="profile-hero__name">{user.name}</div>
          <div className="profile-hero__email">{user.email || 'Demo Account'}</div>
          <div className="profile-hero__badges">
            <span className={`badge ${user.isPremium ? 'badge--premium' : 'badge--free'}`}>
              {user.isPremium ? `💎 ${t('profile.premium')}` : t('profile.free')}
            </span>
            <span className="badge badge--neutral">
              🤖 {t('profile.agents_unit', { count: user.agents_count })}
            </span>
          </div>
        </div>
        <div className="profile-hero__stats">
          <div className="profile-hero__stat">
            <div className="profile-hero__stat-value stat__value--gold">💰 {fmt(user.gold_balance)}</div>
            <div className="profile-hero__stat-label">{t('profile.gold_balance')}</div>
          </div>
          <div className="profile-hero__stat">
            <div className="profile-hero__stat-value">🏦 {fmt(Math.round(totalAssets))}</div>
            <div className="profile-hero__stat-label">{t('profile.total_assets')}</div>
          </div>
          <div className="profile-hero__stat">
            <div className={`profile-hero__stat-value ${totalProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalProfit >= 0 ? '📈' : '📉'} {totalProfit >= 0 ? '+' : ''}{fmt(Math.round(totalProfit))} G
            </div>
            <div className="profile-hero__stat-label">
              {totalProfit >= 0 ? '+' : ''}{profitPct.toFixed(1)}% {i18n.language === 'ko' ? '수익' : 'P&L'}
            </div>
          </div>
        </div>
      </section>

      {/* ─── My Agents ─── */}
      <section className="card profile-card">
        <div className="section-header mb-16">
          <h3 className="section-header__title">🤖 {t('profile.my_agents')}</h3>
          <button className="btn btn--primary btn--sm" onClick={() => navigate('/agents/create')}>
            + {i18n.language === 'ko' ? '에이전트 만들기' : 'Create Agent'}
          </button>
        </div>
        {loading ? (
          <div className="spinner spinner--center" />
        ) : myAgents.length === 0 ? (
          <div className="empty-state p-y-24">
            <p>{t('profile.no_agents')}</p>
            <button className="btn btn--primary btn--sm mt-12" onClick={() => navigate('/agents/create')}>
              {t('profile.create_agent_cta')}
            </button>
          </div>
        ) : (
          <div className="my-agents-grid">
            {myAgents.map((agent) => (
              <Link key={agent.id} to={`/agents/${agent.id}`} className="my-agent-card">
                <div className="my-agent-card__header">
                  <span className="my-agent-card__faction">{getFactionEmoji(agent.faction)}</span>
                  <span className="my-agent-card__name">{agent.name}</span>
                </div>
                <div className="my-agent-card__stats">
                  <div className="my-agent-card__stat">
                    <span className="my-agent-card__stat-label">ELO</span>
                    <span className="my-agent-card__stat-value">{Math.round(agent.elo_score)}</span>
                  </div>
                  <div className="my-agent-card__stat">
                    <span className="my-agent-card__stat-label">{i18n.language === 'ko' ? '승률' : 'Win%'}</span>
                    <span className="my-agent-card__stat-value">{(agent.win_rate * 100).toFixed(0)}%</span>
                  </div>
                  <div className="my-agent-card__stat">
                    <span className="my-agent-card__stat-label">{i18n.language === 'ko' ? '토론' : 'Debates'}</span>
                    <span className="my-agent-card__stat-value">{agent.total_debates}</span>
                  </div>
                </div>
                <p className="my-agent-card__persona">{agent.persona}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ─── Portfolio History Chart ─── */}
      <section className="card profile-card">
        <h3>📈 {t('profile.asset_growth')}</h3>
        <div className="chart-container mt-16">
          <PortfolioChart data={history} height={250} />
        </div>
      </section>

      {/* ─── Investment Summary ─── */}
      <section className="card profile-card">
        <h3>📊 {t('profile.portfolio_summary')}</h3>
        <div className="profile-stats-grid">
          <div className="profile-stat-card">
            <div className="stat__label">{t('profile.gold_balance')}</div>
            <div className="stat__value stat__value--gold">💰 {fmt(user.gold_balance)} G</div>
          </div>
          <div className="profile-stat-card">
            <div className="stat__label">{t('profile.portfolio_value')}</div>
            <div className="stat__value">📈 {fmt(Math.round(portfolioValue))} G</div>
          </div>
          <div className="profile-stat-card">
            <div className="stat__label">{t('profile.total_assets')}</div>
            <div className="stat__value stat__value--highlight">🏦 {fmt(Math.round(totalAssets))} G</div>
          </div>
          <div className="profile-stat-card">
            <div className="stat__label">{i18n.language === 'ko' ? '총 수익' : 'Total P&L'}</div>
            <div className={`stat__value ${totalProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalProfit >= 0 ? '+' : ''}{fmt(Math.round(totalProfit))} G
            </div>
          </div>
        </div>
      </section>

      {/* ─── Usage Limits ─── */}
      <section className="card profile-card usage-limits-card">
        <div className="section-header">
          <h3 className="section-header__title">{t('profile.usage_limits')}</h3>
          {!user.isPremium && (
            <button className="btn btn--primary btn--xs" onClick={() => alert('Premium service coming soon!')}>
              💎 {t('profile.upgrade_to_premium')}
            </button>
          )}
        </div>
        <div className="usage-grid mt-16">
          <div className="usage-item">
            <span className="usage-item__label">{t('profile.usage_debate')}</span>
            <div className="usage-bar-container">
              <div
                className={`usage-bar ${user.isPremium ? 'usage-bar--unlimited' : (usage?.debates_today ?? 0) >= 10 ? 'usage-bar--full' : ''}`}
                style={{ width: user.isPremium ? '100%' : `${Math.min(((usage?.debates_today ?? 0) / 10) * 100, 100)}%` }}
              />
            </div>
            <span className="usage-item__value">
              {user.isPremium ? t('profile.usage_unlimited') : `${usage?.debates_today ?? 0} / 10`}
            </span>
          </div>
          <div className="usage-item">
            <span className="usage-item__label">{t('profile.usage_trade')}</span>
            <div className="usage-bar-container">
              <div
                className={`usage-bar ${user.isPremium ? 'usage-bar--unlimited' : (usage?.trades_today ?? 0) >= 20 ? 'usage-bar--full' : ''}`}
                style={{ width: user.isPremium ? '100%' : `${Math.min(((usage?.trades_today ?? 0) / 20) * 100, 100)}%` }}
              />
            </div>
            <span className="usage-item__value">
              {user.isPremium ? t('profile.usage_unlimited') : `${usage?.trades_today ?? 0} / 20`}
            </span>
          </div>
          <div className="usage-item">
            <span className="usage-item__label">{t('profile.usage_agent')}</span>
            <div className="usage-bar-container">
              <div
                className={`usage-bar ${user.isPremium ? 'usage-bar--unlimited' : (user.agents_count ?? 0) >= 3 ? 'usage-bar--full' : ''}`}
                style={{ width: user.isPremium ? '100%' : `${Math.min(((user.agents_count ?? 0) / 3) * 100, 100)}%` }}
              />
            </div>
            <span className="usage-item__value">
              {user.isPremium ? t('profile.usage_unlimited') : `${user.agents_count ?? 0} / 3`}
            </span>
          </div>
        </div>
      </section>

      {/* ─── My Portfolio ─── */}
      <section className="card profile-card">
        <div className="section-header mb-16">
          <h3 className="section-header__title">💼 {t('profile.my_portfolio')}</h3>
        </div>
        {loading ? (
          <div className="spinner spinner--center" />
        ) : portfolio.length === 0 ? (
          <div className="empty-state p-y-24">
            <p>{t('profile.no_portfolio')}</p>
            <button className="btn btn--primary btn--sm mt-12" onClick={() => navigate('/market')}>
              {t('profile.go_market')}
            </button>
          </div>
        ) : (
          <div className="profile-portfolio-table">
            <div className="profile-portfolio-header">
              <span>{t('market.list.agent')}</span>
              <span>{t('market.list.shares_unit')}</span>
              <span>{t('market.portfolio.avg_cost')}</span>
              <span>{t('market.portfolio.current_price')}</span>
              <span>{t('market.portfolio.valuation')}</span>
              <span>{t('market.portfolio.pnl')}</span>
            </div>
            {portfolio.map((item) => (
              <div key={item.stock_id} className="profile-portfolio-row">
                <Link to={`/agents/${item.agent_id}`} className="profile-portfolio-agent agent-link">{item.agent_name}</Link>
                <span>{item.shares_owned}</span>
                <span>{fmt(Math.round(item.avg_buy_price))} G</span>
                <span>{fmt(Math.round(item.current_price))} G</span>
                <span>{fmt(Math.round(item.total_value))} G</span>
                <span className={item.profit >= 0 ? 'text-profit' : 'text-loss'}>
                  {item.profit >= 0 ? '+' : ''}{fmt(Math.round(item.profit))} G
                  <small> ({item.profit_pct >= 0 ? '+' : ''}{item.profit_pct.toFixed(1)}%)</small>
                </span>
              </div>
            ))}
            <div className="profile-portfolio-total">
              <span className="grid-col-span-4">{t('profile.total_assets')}</span>
              <span>{fmt(Math.round(portfolioValue))} G</span>
              <span className={totalProfit >= 0 ? 'text-profit' : 'text-loss'}>
                {totalProfit >= 0 ? '+' : ''}{fmt(Math.round(totalProfit))} G
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ─── Trade History ─── */}
      <section className="card profile-card">
        <h3>📜 {t('profile.recent_trades')}</h3>

        {/* Tabs */}
        <div className="trade-tabs">
          <button
            className={`trade-tab ${tradeTab === 'stock' ? 'trade-tab--active' : ''}`}
            onClick={() => setTradeTab('stock')}
          >
            {t('profile.stock_trades')}
          </button>
          <button
            className={`trade-tab ${tradeTab === 'gold' ? 'trade-tab--active' : ''}`}
            onClick={() => setTradeTab('gold')}
          >
            {t('profile.gold_trades')}
          </button>
        </div>

        {/* Stock Trades Tab */}
        {tradeTab === 'stock' && (
          <div className="trade-history-table">
            {trades.length === 0 ? (
              <div className="empty-state p-y-24">
                <p>{t('profile.no_trades')}</p>
              </div>
            ) : (
              <>
                <div className="trade-history-header">
                  <span>{t('market.list.agent')}</span>
                  <span>{t('profile.trade_type')}</span>
                  <span>{t('profile.trade_qty')}</span>
                  <span>{t('profile.trade_price')}</span>
                  <span>{t('profile.trade_total')}</span>
                  <span>{t('profile.trade_time')}</span>
                </div>
                {trades.map((tr) => (
                  <div key={tr.id} className="trade-history-row">
                    <span className="text-bold">{tr.agent_name}</span>
                    <span>
                      <span className={`trade-type-badge trade-type-badge--${tr.type}`}>
                        {t(`profile.trade_type_${tr.type}`)}
                      </span>
                    </span>
                    <span>{tr.shares}</span>
                    <span>{fmt(Math.round(tr.price))} G</span>
                    <span>{fmt(Math.round(tr.total_amount))} G</span>
                    <span className="text-sm-secondary">
                      {fmtDate(tr.timestamp)}
                    </span>
                  </div>
                ))}
                {trades.length >= tradeLimit && (
                  <button
                    className="btn btn--ghost btn--sm btn--load-more"
                    onClick={() => setTradeLimit((l) => l + 10)}
                  >
                    {t('profile.load_more')}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Gold Transactions Tab */}
        {tradeTab === 'gold' && (
          <div className="trade-history-table">
            {goldTxns.length === 0 ? (
              <div className="empty-state p-y-24">
                <p>{t('profile.no_gold_history')}</p>
              </div>
            ) : (
              <>
                <div className="gold-history-header">
                  <span>{t('profile.gold_amount')}</span>
                  <span>{t('profile.trade_type')}</span>
                  <span>{t('profile.gold_desc')}</span>
                  <span>{t('profile.trade_time')}</span>
                </div>
                {goldTxns.map((g) => {
                  const isPositive = g.amount > 0;
                  return (
                    <div key={g.id} className="gold-history-row">
                      <span className={isPositive ? 'text-profit' : 'text-loss'}>
                        {isPositive ? '+' : ''}{fmt(g.amount)} G
                      </span>
                      <span>
                        <span className={`trade-type-badge trade-type-badge--${isPositive ? 'earn' : 'spend'}`}>
                          {g.type}
                        </span>
                      </span>
                      <span className="text-sm-muted">{g.description || '-'}</span>
                      <span className="text-sm-secondary">
                        {fmtDate(g.timestamp)}
                      </span>
                    </div>
                  );
                })}
                {goldTxns.length >= goldLimit && (
                  <button
                    className="btn btn--ghost btn--sm btn--load-more"
                    onClick={() => setGoldLimit((l) => l + 10)}
                  >
                    {t('profile.load_more')}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
