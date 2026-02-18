import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../AuthContext.js';
import {
  fetchPortfolio,
  fetchRecentTrades,
  fetchGoldHistory,
  type PortfolioItem,
  type TradeRecord,
  type GoldTransaction,
} from '../api.js';

type TradeTab = 'stock' | 'gold';

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuthContext();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [goldTxns, setGoldTxns] = useState<GoldTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeTab, setTradeTab] = useState<TradeTab>('stock');
  const [tradeLimit, setTradeLimit] = useState(10);
  const [goldLimit, setGoldLimit] = useState(10);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetchPortfolio(),
      fetchRecentTrades(tradeLimit),
      fetchGoldHistory(goldLimit),
    ])
      .then(([p, tr, gl]) => {
        setPortfolio(p);
        setTrades(tr);
        setGoldTxns(gl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
        <div className="card skeleton" style={{ height: 200, marginBottom: 24 }} />
        <div className="grid grid--2">
          <div className="card skeleton" style={{ height: 160 }} />
          <div className="card skeleton" style={{ height: 160 }} />
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

  return (
    <div className="profile-page animate-fade-in">
      {/* ─── Header ─── */}
      <div className="section-header">
        <div>
          <h2 className="section-header__title">{t('profile.title')}</h2>
          <p className="section-header__subtitle">{t('profile.subtitle')}</p>
        </div>
      </div>

      {/* ─── Account Info ─── */}
      <section className="card profile-card">
        <h3>📋 {t('profile.account')}</h3>
        <div className="profile-info-grid">
          <div className="profile-info-item">
            <span className="stat__label">{t('profile.name')}</span>
            <span className="stat__value">{user.name}</span>
          </div>
          <div className="profile-info-item">
            <span className="stat__label">{t('profile.email')}</span>
            <span className="stat__value" style={{ fontSize: '0.9rem' }}>{user.email || '-'}</span>
          </div>
          <div className="profile-info-item">
            <span className="stat__label">{t('profile.membership')}</span>
            <span className={`badge ${user.isPremium ? 'badge--premium' : 'badge--free'}`}>
              {user.isPremium ? t('profile.premium') : t('profile.free')}
            </span>
          </div>
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
            <div className="stat__label">{t('profile.agents_created')}</div>
            <div className="stat__value">🤖 {t('profile.agents_unit', { count: user.agents_count })}</div>
          </div>
        </div>
      </section>

      {/* ─── My Portfolio ─── */}
      <section className="card profile-card">
        <div className="section-header" style={{ marginBottom: 16 }}>
          <h3 className="section-header__title">💼 {t('profile.my_portfolio')}</h3>
        </div>
        {loading ? (
          <div className="spinner" style={{ margin: '24px auto' }} />
        ) : portfolio.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p>{t('profile.no_portfolio')}</p>
            <button className="btn btn--primary btn--sm" onClick={() => navigate('/market')} style={{ marginTop: 12 }}>
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
                <span className="profile-portfolio-agent">{item.agent_name}</span>
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
              <span style={{ gridColumn: 'span 4' }}>{t('profile.total_assets')}</span>
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
              <div className="empty-state" style={{ padding: '24px 0' }}>
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
                    <span style={{ fontWeight: 600 }}>{tr.agent_name}</span>
                    <span>
                      <span className={`trade-type-badge trade-type-badge--${tr.type}`}>
                        {t(`profile.trade_type_${tr.type}`)}
                      </span>
                    </span>
                    <span>{tr.shares}</span>
                    <span>{fmt(Math.round(tr.price))} G</span>
                    <span>{fmt(Math.round(tr.total_amount))} G</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
              <div className="empty-state" style={{ padding: '24px 0' }}>
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
                      <span style={{ fontSize: '0.8rem' }}>{g.description || '-'}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
