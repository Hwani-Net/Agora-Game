import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchStocks, fetchPortfolio, tradeStock, type PortfolioItem, type TradeResult } from '../api.js';
import { useAuthContext } from '../AuthContext.js';
import { useToast } from '../ToastContext.js';

interface Stock {
  id: string;
  agent_id: string;
  agent_name?: string;
  current_price: number;
  total_shares: number;
  available_shares: number;
  market_cap: number;
  price_change_24h: number;
}

type TradeTab = 'buy' | 'sell';

export default function MarketPage() {
  const { t } = useTranslation();
  const { user, refreshProfile, login } = useAuthContext();
  const { pushToast } = useToast();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [tradeTab, setTradeTab] = useState<TradeTab>('buy');
  const [quantity, setQuantity] = useState(1);
  const [trading, setTrading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [stocksData, portfolioData] = await Promise.all([
        fetchStocks(),
        user ? fetchPortfolio() : Promise.resolve([]),
      ]);
      setStocks(Array.isArray(stocksData) ? (stocksData as Stock[]) : []);
      setPortfolio(portfolioData);
    } catch {
      setStocks([]);
      setPortfolio([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);



  function priceChangePrefix(change: number): string {
    return change > 0 ? '+' : '';
  }

  function miniChartBars() {
    return Array.from({ length: 12 }, () => 15 + Math.random() * 85);
  }

  function openTradeModal(stock: Stock, tab: TradeTab = 'buy') {
    setSelectedStock(stock);
    setTradeTab(tab);
    setQuantity(1);
  }

  function closeTradeModal() {
    setSelectedStock(null);
    setQuantity(1);
  }

  // Find user's ownership for the selected stock
  function getOwnedShares(stockId: string): number {
    return portfolio.find((p) => p.stock_id === stockId)?.shares_owned || 0;
  }

  // Max quantity user can buy (limited by gold and available shares)
  function getMaxBuyQuantity(): number {
    if (!selectedStock || !user) return 0;
    const byGold = Math.floor(user.gold_balance / selectedStock.current_price);
    return Math.min(byGold, selectedStock.available_shares);
  }

  async function handleTrade() {
    if (!selectedStock || !user) return;
    setTrading(true);
    try {
      const result: TradeResult = await tradeStock(selectedStock.id, tradeTab, quantity);
      if (result.success) {
        const actionLabel = tradeTab === 'buy' ? t('market.trade_modal.buy') : t('market.trade_modal.sell');
        const amount = tradeTab === 'buy' ? result.total_cost : result.total_revenue;

        pushToast(
          t('market.messages.trade_success', {
            action: actionLabel,
            qty: quantity,
            price: Math.round(selectedStock.current_price).toLocaleString(),
            total: Math.round(amount || 0).toLocaleString(),
          }),
          'success'
        );
        closeTradeModal();
        // Reload data
        await Promise.all([loadData(), refreshProfile()]);
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : t('common.error'), 'error');
    } finally {
      setTrading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner" />
      </div>
    );
  }

  const totalPortfolioValue = portfolio.reduce((sum, p) => sum + p.total_value, 0);
  const totalProfit = portfolio.reduce((sum, p) => sum + p.profit, 0);

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-header__title">📊 {t('market.title')}</h2>
          <p className="section-header__subtitle">{t('market.subtitle')}</p>
        </div>
        {user && (
          <div className="market-gold-badge">
            💰 {user.gold_balance.toLocaleString()} G
          </div>
        )}
      </div>

      {/* ─── Portfolio Section ─── */}
      {user && portfolio.length > 0 && (
        <div className="portfolio-section animate-slide-up">
          <div className="portfolio-summary">
            <div className="portfolio-summary__item">
              <span className="portfolio-summary__label">{t('market.portfolio.owned_stocks')}</span>
              <span className="portfolio-summary__value">{portfolio.length}</span>
            </div>
            <div className="portfolio-summary__item">
              <span className="portfolio-summary__label">{t('market.portfolio.valuation')}</span>
              <span className="portfolio-summary__value">
                {Math.round(totalPortfolioValue).toLocaleString()} G
              </span>
            </div>
            <div className="portfolio-summary__item">
              <span className="portfolio-summary__label">{t('market.portfolio.profit')}</span>
              <span className={`portfolio-summary__value ${totalProfit > 0 ? 'profit--up' : totalProfit < 0 ? 'profit--down' : ''}`}>
                {totalProfit > 0 ? '+' : ''}
                {Math.round(totalProfit).toLocaleString()} G
              </span>
            </div>
            <div className="portfolio-summary__item">
              <span className="portfolio-summary__label">{t('market.portfolio.total_assets')}</span>
              <span className="portfolio-summary__value portfolio-summary__value--highlight">
                {(user.gold_balance + Math.round(totalPortfolioValue)).toLocaleString()} G
              </span>
            </div>
          </div>

          <h3 className="portfolio-title">{t('market.portfolio.title')}</h3>
          <div className="portfolio-list">
            {portfolio.map((item) => (
              <div key={item.stock_id} className="portfolio-item card">
                <div className="portfolio-item__info">
                  <span className="portfolio-item__name">🤖 {item.agent_name}</span>
                  <span className="portfolio-item__shares">{t('market.portfolio.shares', { count: item.shares_owned })}</span>
                </div>
                <div className="portfolio-item__prices">
                  <div>
                    <span className="portfolio-item__label">{t('market.portfolio.avg_cost')}</span>
                    <span className="portfolio-item__avg">
                      {Math.round(item.avg_buy_price).toLocaleString()} G
                    </span>
                  </div>
                  <div>
                    <span className="portfolio-item__label">{t('market.portfolio.current_price')}</span>
                    <span className="portfolio-item__current">
                      {Math.round(item.current_price).toLocaleString()} G
                    </span>
                  </div>
                  <div>
                    <span className="portfolio-item__label">{t('market.portfolio.pnl')}</span>
                    <span className={`portfolio-item__pnl ${item.profit >= 0 ? 'profit--up' : 'profit--down'}`}>
                      {item.profit >= 0 ? '+' : ''}
                      {item.profit_pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn--sm btn--sell"
                  onClick={() => {
                    const stock = stocks.find((s) => s.id === item.stock_id);
                    if (stock) openTradeModal(stock, 'sell');
                  }}
                >
                  {t('market.trade_modal.sell')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Stock List ─── */}
      {stocks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📈</div>
          <div className="empty-state__title">{t('market.messages.no_stocks')}</div>
          <p>{t('market.messages.ipo_hint')}</p>
        </div>
      ) : (
        <div className="market-list-container">
          {/* Table Header */}
          <div className="market-table-header">
            <span>{t('market.list.agent')}</span>
            <span className="text-right">{t('market.list.price')}</span>
            <span className="text-right">{t('market.list.change')}</span>
            <span className="text-right">{t('market.list.market_cap')}</span>
            <span className="text-right">{t('market.list.avail_shares')}</span>
            <span className="text-center">{t('market.list.chart')}</span>
            <span className="text-center">{t('market.list.trade')}</span>
          </div>

          {/* Stock Rows */}
          {stocks.map((stock) => {
            const bars = miniChartBars();
            const owned = getOwnedShares(stock.id);
            return (
              <div
                key={stock.id}
                className="card market-stock-row"
              >
                <div>
                  <div className="market-stock__name">
                    🤖 {stock.agent_name || `Agent #${stock.agent_id.slice(0, 8)}`}
                  </div>
                  <div className="market-stock__meta">
                    {stock.total_shares.toLocaleString()} {t('market.list.shares_unit')}
                    {owned > 0 && (
                      <span className="owned-badge">
                        {' '}
                        · {t('market.trade_modal.owned')} {owned}
                      </span>
                    )}
                  </div>
                </div>
                <div className="market-cell-mono market-cell-price">
                  {Math.round(stock.current_price).toLocaleString()} G
                </div>
                <div
                  className={`market-cell-mono market-stock__price-change ${stock.price_change_24h > 0 ? 'market-stock__price-change--up' : stock.price_change_24h < 0 ? 'market-stock__price-change--down' : 'market-stock__price-change--flat'}`}
                >
                  {priceChangePrefix(stock.price_change_24h)}
                  {stock.price_change_24h.toFixed(1)}%
                </div>
                <div className="market-cell-mono">{(stock.market_cap / 1000).toFixed(0)}K</div>
                <div className="market-cell-mono">{stock.available_shares.toLocaleString()}</div>
                <div className="stock-mini-chart">
                  {bars.map((h, i) => (
                    <div
                      key={i}
                      className="stock-mini-chart__bar"
                      style={{
                        height: `${h}%`,
                        background: stock.price_change_24h >= 0 ? 'var(--success)' : 'var(--danger)',
                      }}
                    />
                  ))}
                </div>
                <div className="market-cell-actions">
                  {user ? (
                    <div className="flex-center gap-1">
                      <button
                        className="btn btn--xs btn--buy"
                        onClick={() => openTradeModal(stock, 'buy')}
                      >
                        {t('market.trade_modal.buy')}
                      </button>
                      {owned > 0 && (
                        <button
                          className="btn btn--xs btn--sell"
                          onClick={() => openTradeModal(stock, 'sell')}
                        >
                          {t('market.trade_modal.sell')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex-center">
                      <button
                        className="btn btn--xs btn--ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          pushToast(t('market.messages.login_prompt'), 'info');
                          login().catch((err: Error) => pushToast(err.message, 'error'));
                        }}
                      >
                        🔒 {t('nav.login')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Trade Modal ─── */}
      {selectedStock && user && (
        <div className="trade-overlay" onClick={closeTradeModal}>
          <div className="trade-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="trade-modal__header">
              <h3>🤖 {selectedStock.agent_name || 'Agent'}</h3>
              <button className="trade-modal__close" onClick={closeTradeModal}>
                ✕
              </button>
            </div>

            {/* Price Info */}
            <div className="trade-modal__price-row">
              <div>
                <span className="trade-modal__price-label">{t('market.list.price')}</span>
                <span className="trade-modal__price-value">
                  {Math.round(selectedStock.current_price).toLocaleString()} G
                </span>
              </div>
              <div>
                <span className="trade-modal__price-label">{t('market.list.avail_shares')}</span>
                <span className="trade-modal__price-value">
                  {selectedStock.available_shares.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="trade-modal__price-label">{t('market.trade_modal.owned')}</span>
                <span className="trade-modal__price-value">
                  {t('market.portfolio.shares', { count: getOwnedShares(selectedStock.id) })}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="trade-tabs">
              <button
                className={`trade-tab ${tradeTab === 'buy' ? 'trade-tab--active trade-tab--buy' : ''}`}
                onClick={() => {
                  setTradeTab('buy');
                  setQuantity(1);
                }}
              >
                {t('market.trade_modal.buy')}
              </button>
              <button
                className={`trade-tab ${tradeTab === 'sell' ? 'trade-tab--active trade-tab--sell' : ''}`}
                onClick={() => {
                  setTradeTab('sell');
                  setQuantity(1);
                }}
                disabled={getOwnedShares(selectedStock.id) === 0}
              >
                {t('market.trade_modal.sell')}
              </button>
            </div>

            {/* Quantity Input */}
            <div className="trade-quantity">
              <label className="trade-quantity__label">{t('market.trade_modal.amount')}</label>
              <div className="trade-quantity__controls">
                <div className="trade-quantity__quick">
                  {[1, 5, 10, 50].map((n) => (
                    <button
                      key={n}
                      className="btn btn--xs btn--ghost"
                      onClick={() => setQuantity(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    className="btn btn--xs btn--ghost"
                    onClick={() => {
                      if (tradeTab === 'buy') {
                        setQuantity(getMaxBuyQuantity());
                      } else {
                        setQuantity(getOwnedShares(selectedStock.id));
                      }
                    }}
                  >
                    MAX
                  </button>
                </div>
                <div className="trade-quantity__input-row">
                  <button
                    className="trade-qty-btn"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className="trade-qty-input"
                    value={quantity}
                    min={1}
                    max={tradeTab === 'buy' ? getMaxBuyQuantity() : getOwnedShares(selectedStock.id)}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <button className="trade-qty-btn" onClick={() => setQuantity(quantity + 1)}>
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="trade-summary">
              <div className="trade-summary__row">
                <span>
                  {tradeTab === 'buy'
                    ? t('market.trade_modal.total_buy_cost')
                    : t('market.trade_modal.total_sell_revenue')}
                </span>
                <span className="trade-summary__amount">
                  {Math.round(selectedStock.current_price * quantity).toLocaleString()} G
                </span>
              </div>
              <div className="trade-summary__row">
                <span>{t('market.trade_modal.balance')}</span>
                <span>{user.gold_balance.toLocaleString()} G</span>
              </div>
              {tradeTab === 'buy' && (
                <div className="trade-summary__row">
                  <span>{t('market.trade_modal.after_balance')}</span>
                  <span
                    className={
                      user.gold_balance - Math.round(selectedStock.current_price * quantity) < 0
                        ? 'profit--down'
                        : ''
                    }
                  >
                    {(
                      user.gold_balance - Math.round(selectedStock.current_price * quantity)
                    ).toLocaleString()}{' '}
                    G
                  </span>
                </div>
              )}
            </div>

            {/* Action Button */}
            <button
              className={`btn btn--lg trade-btn ${tradeTab === 'buy' ? 'trade-btn--buy' : 'trade-btn--sell'}`}
              disabled={
                trading ||
                quantity <= 0 ||
                (tradeTab === 'buy' &&
                  (quantity > selectedStock.available_shares ||
                    selectedStock.current_price * quantity > user.gold_balance)) ||
                (tradeTab === 'sell' && quantity > getOwnedShares(selectedStock.id))
              }
              onClick={handleTrade}
            >
              {trading
                ? t('common.loading')
                : tradeTab === 'buy'
                  ? t('market.trade_modal.action_buy', { count: quantity })
                  : t('market.trade_modal.action_sell', { count: quantity })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
