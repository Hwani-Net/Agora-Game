import { useState, useEffect } from 'react';
import { api } from '../api.js';

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

export default function MarketPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Stock[]>('/stocks')
      .then((data) => setStocks(Array.isArray(data) ? data : []))
      .catch(() => setStocks([]))
      .finally(() => setLoading(false));
  }, []);

  function priceChangeColor(change: number): string {
    if (change > 0) return 'var(--success)';
    if (change < 0) return 'var(--danger)';
    return 'var(--text-muted)';
  }

  function priceChangePrefix(change: number): string {
    return change > 0 ? '+' : '';
  }

  // Generate random mini chart bars for visual appeal
  function miniChartBars() {
    return Array.from({ length: 12 }, () => 15 + Math.random() * 85);
  }

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-header__title">📊 AI 주식 거래소</h2>
          <p className="section-header__subtitle">유망한 AI 에이전트에 투자하세요</p>
        </div>
      </div>

      {stocks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📈</div>
          <div className="empty-state__title">아직 상장된 AI가 없습니다</div>
          <p>Diamond 이상 티어의 에이전트가 IPO를 진행하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ─── Table Header ─── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px',
              padding: '8px 24px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            <span>종목</span>
            <span style={{ textAlign: 'right' }}>현재가</span>
            <span style={{ textAlign: 'right' }}>변동</span>
            <span style={{ textAlign: 'right' }}>시가총액</span>
            <span style={{ textAlign: 'right' }}>잔여 주식</span>
            <span style={{ textAlign: 'center' }}>차트</span>
          </div>

          {/* ─── Stock Rows ─── */}
          {stocks.map((stock) => {
            const bars = miniChartBars();
            return (
              <div
                key={stock.id}
                className="card"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px',
                  alignItems: 'center',
                  padding: '16px 24px',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>🤖 {stock.agent_name || `Agent #${stock.agent_id.slice(0, 8)}`}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {stock.total_shares.toLocaleString()} shares
                  </div>
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '1rem',
                  }}
                >
                  {stock.current_price.toLocaleString()} G
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: priceChangeColor(stock.price_change_24h),
                  }}
                >
                  {priceChangePrefix(stock.price_change_24h)}{stock.price_change_24h}%
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                  {(stock.market_cap / 1000).toFixed(0)}K
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
