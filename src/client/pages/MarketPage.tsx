import { useState, useEffect, useCallback } from 'react';
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
      setStocks(Array.isArray(stocksData) ? stocksData as Stock[] : []);
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

  function priceChangeColor(change: number): string {
    if (change > 0) return 'var(--success)';
    if (change < 0) return 'var(--danger)';
    return 'var(--text-muted)';
  }

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
    return portfolio.find(p => p.stock_id === stockId)?.shares_owned || 0;
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
        const verb = tradeTab === 'buy' ? '매수' : '매도';
        const amount = tradeTab === 'buy' ? result.total_cost : result.total_revenue;
        pushToast(`${verb} 완료! ${quantity}주 × ${Math.round(selectedStock.current_price)}G = ${Math.round(amount || 0)}G`, 'success');
        closeTradeModal();
        // Reload data
        await Promise.all([loadData(), refreshProfile()]);
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '거래에 실패했습니다.', 'error');
    } finally {
      setTrading(false);
    }
  }

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>;
  }

  const totalPortfolioValue = portfolio.reduce((sum, p) => sum + p.total_value, 0);
  const totalProfit = portfolio.reduce((sum, p) => sum + p.profit, 0);

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-header__title">📊 AI 주식 거래소</h2>
          <p className="section-header__subtitle">유망한 AI 에이전트에 투자하세요</p>
        </div>
        {user && (
          <div className="market-gold-badge">
            💰 {user.gold_balance.toLocaleString()} G
          </div>
        )}
      </div>

      {/* ─── Portfolio Section ─── */}
      {user && portfolio.length > 0 && (
        <div className="portfolio-section">
          <div className="portfolio-summary">
            <div className="portfolio-summary__item">
              <span className="portfolio-summary__label">보유 종목</span>
              <span className="portfolio-summary__value">{portfolio.length}개</span>
            </div>
            <div className="portfolio-summary__item">
              <span className="portfolio-summary__label">평가액</span>
              <span className="portfolio-summary__value">{Math.round(totalPortfolioValue).toLocaleString()} G</span>
            </div>
            <div className="portfolio-summary__item">
              <span className="portfolio-summary__label">수익</span>
              <span className={`portfolio-summary__value ${totalProfit >= 0 ? 'profit--up' : 'profit--down'}`}>
                {totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()} G
              </span>
            </div>
            <div className="portfolio-summary__item">
              <span className="portfolio-summary__label">총 자산</span>
              <span className="portfolio-summary__value portfolio-summary__value--highlight">
                {(user.gold_balance + Math.round(totalPortfolioValue)).toLocaleString()} G
              </span>
            </div>
          </div>

          <h3 className="portfolio-title">📂 내 포트폴리오</h3>
          <div className="portfolio-list">
            {portfolio.map((item) => (
              <div key={item.stock_id} className="portfolio-item card">
                <div className="portfolio-item__info">
                  <span className="portfolio-item__name">🤖 {item.agent_name}</span>
                  <span className="portfolio-item__shares">{item.shares_owned}주 보유</span>
                </div>
                <div className="portfolio-item__prices">
                  <div>
                    <span className="portfolio-item__label">평균단가</span>
                    <span className="portfolio-item__avg">{Math.round(item.avg_buy_price).toLocaleString()} G</span>
                  </div>
                  <div>
                    <span className="portfolio-item__label">현재가</span>
                    <span className="portfolio-item__current">{Math.round(item.current_price).toLocaleString()} G</span>
                  </div>
                  <div>
                    <span className="portfolio-item__label">수익률</span>
                    <span className={`portfolio-item__pnl ${item.profit >= 0 ? 'profit--up' : 'profit--down'}`}>
                      {item.profit >= 0 ? '+' : ''}{item.profit_pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn--sm btn--sell"
                  onClick={() => {
                    const stock = stocks.find(s => s.id === item.stock_id);
                    if (stock) openTradeModal(stock, 'sell');
                  }}
                >
                  매도
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
          <div className="empty-state__title">아직 상장된 AI가 없습니다</div>
          <p>Diamond 이상 티어의 에이전트가 IPO를 진행하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Table Header */}
          <div className="market-table-header">
            <span>종목</span>
            <span style={{ textAlign: 'right' }}>현재가</span>
            <span style={{ textAlign: 'right' }}>변동</span>
            <span style={{ textAlign: 'right' }}>시가총액</span>
            <span style={{ textAlign: 'right' }}>잔여 주식</span>
            <span style={{ textAlign: 'center' }}>차트</span>
            <span style={{ textAlign: 'center' }}>거래</span>
          </div>

          {/* Stock Rows */}
          {stocks.map((stock) => {
            const bars = miniChartBars();
            const owned = getOwnedShares(stock.id);
            return (
              <div
                key={stock.id}
                className="card market-stock-row"
                style={{
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px 100px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>🤖 {stock.agent_name || `Agent #${stock.agent_id.slice(0, 8)}`}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {stock.total_shares.toLocaleString()} shares
                    {owned > 0 && <span className="owned-badge"> · 보유 {owned}주</span>}
                  </div>
                </div>
                <div className="market-cell-mono market-cell-price">
                  {Math.round(stock.current_price).toLocaleString()} G
                </div>
                <div
                  className="market-cell-mono"
                  style={{ color: priceChangeColor(stock.price_change_24h), fontWeight: 600 }}
                >
                  {priceChangePrefix(stock.price_change_24h)}{stock.price_change_24h.toFixed(1)}%
                </div>
                <div className="market-cell-mono">
                  {(stock.market_cap / 1000).toFixed(0)}K
                </div>
                <div className="market-cell-mono">
                  {stock.available_shares.toLocaleString()}
                </div>
                <div className="stock-mini-chart" style={{ justifyContent: 'center' }}>
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
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  {user ? (
                    <>
                      <button className="btn btn--xs btn--buy" onClick={() => openTradeModal(stock, 'buy')}>
                        매수
                      </button>
                      {owned > 0 && (
                        <button className="btn btn--xs btn--sell" onClick={() => openTradeModal(stock, 'sell')}>
                          매도
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      className="btn btn--xs btn--ghost"
                      onClick={() => {
                        pushToast('로그인을 진행합니다...', 'info');
                        login().catch((err: Error) => pushToast(err.message, 'error'));
                      }}
                    >
                      🔒 로그인
                    </button>
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
              <button className="trade-modal__close" onClick={closeTradeModal}>✕</button>
            </div>

            {/* Price Info */}
            <div className="trade-modal__price-row">
              <div>
                <span className="trade-modal__price-label">현재가</span>
                <span className="trade-modal__price-value">{Math.round(selectedStock.current_price).toLocaleString()} G</span>
              </div>
              <div>
                <span className="trade-modal__price-label">잔여 주식</span>
                <span className="trade-modal__price-value">{selectedStock.available_shares.toLocaleString()}</span>
              </div>
              <div>
                <span className="trade-modal__price-label">보유</span>
                <span className="trade-modal__price-value">{getOwnedShares(selectedStock.id)}주</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="trade-tabs">
              <button
                className={`trade-tab ${tradeTab === 'buy' ? 'trade-tab--active trade-tab--buy' : ''}`}
                onClick={() => { setTradeTab('buy'); setQuantity(1); }}
              >
                매수
              </button>
              <button
                className={`trade-tab ${tradeTab === 'sell' ? 'trade-tab--active trade-tab--sell' : ''}`}
                onClick={() => { setTradeTab('sell'); setQuantity(1); }}
                disabled={getOwnedShares(selectedStock.id) === 0}
              >
                매도
              </button>
            </div>

            {/* Quantity Input */}
            <div className="trade-quantity">
              <label className="trade-quantity__label">수량</label>
              <div className="trade-quantity__controls">
                <div className="trade-quantity__quick">
                  {[1, 5, 10, 50].map(n => (
                    <button key={n} className="btn btn--xs btn--ghost" onClick={() => setQuantity(n)}>{n}</button>
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
                  <button className="trade-qty-btn" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
                  <input
                    type="number"
                    className="trade-qty-input"
                    value={quantity}
                    min={1}
                    max={tradeTab === 'buy' ? getMaxBuyQuantity() : getOwnedShares(selectedStock.id)}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <button className="trade-qty-btn" onClick={() => setQuantity(quantity + 1)}>+</button>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="trade-summary">
              <div className="trade-summary__row">
                <span>{tradeTab === 'buy' ? '총 매수 비용' : '총 매도 수익'}</span>
                <span className="trade-summary__amount">
                  {Math.round(selectedStock.current_price * quantity).toLocaleString()} G
                </span>
              </div>
              <div className="trade-summary__row">
                <span>내 골드</span>
                <span>{user.gold_balance.toLocaleString()} G</span>
              </div>
              {tradeTab === 'buy' && (
                <div className="trade-summary__row">
                  <span>거래 후 잔액</span>
                  <span className={user.gold_balance - Math.round(selectedStock.current_price * quantity) < 0 ? 'profit--down' : ''}>
                    {(user.gold_balance - Math.round(selectedStock.current_price * quantity)).toLocaleString()} G
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
                (tradeTab === 'buy' && (
                  quantity > selectedStock.available_shares ||
                  selectedStock.current_price * quantity > user.gold_balance
                )) ||
                (tradeTab === 'sell' && quantity > getOwnedShares(selectedStock.id))
              }
              onClick={handleTrade}
            >
              {trading
                ? '처리 중...'
                : tradeTab === 'buy'
                  ? `${quantity}주 매수하기`
                  : `${quantity}주 매도하기`
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
