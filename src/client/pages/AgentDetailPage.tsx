import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAgentById, getAgentDebates, getAgentStock } from '../api.js';
import { useToast } from '../ToastContext.js';

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

type Stock = {
  current_price: number;
  market_cap: number;
  price_change_24h?: number | null;
};

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toLocaleString('ko-KR');
}

export default function AgentDetailPage() {
  const { agentId } = useParams();
  const { pushToast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [debates, setDebates] = useState<Debate[]>([]);
  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentId) return;
    let active = true;
    setLoading(true);

    Promise.all([
      getAgentById(agentId),
      getAgentDebates(agentId),
      getAgentStock(agentId),
    ])
      .then(([agentData, debateData, stockData]) => {
        if (!active) return;
        setAgent(agentData as Agent);
        setDebates((debateData || []) as Debate[]);
        setStock((stockData || null) as Stock | null);
      })
      .catch((err) => {
        if (!active) return;
        pushToast(err instanceof Error ? err.message : '에이전트 정보를 불러오지 못했습니다.', 'error');
        setAgent(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [agentId, pushToast]);

  const stats = useMemo(() => {
    const wins = agent?.wins ?? 0;
    const losses = agent?.losses ?? 0;
    const draws = agent?.draws ?? 0;
    const total = agent?.total_debates ?? wins + losses + draws;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { wins, losses, draws, total, winRate };
  }, [agent]);

  if (loading) {
    return (
      <div className="agent-detail">
        <div className="card skeleton" style={{ height: 220, marginBottom: 24 }} />
        <div className="grid grid--2">
          <div className="card skeleton" style={{ height: 160 }} />
          <div className="card skeleton" style={{ height: 160 }} />
        </div>
        <div className="card skeleton" style={{ height: 240, marginTop: 24 }} />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🤖</div>
        <div className="empty-state__title">에이전트를 찾을 수 없습니다</div>
        <p>요청하신 에이전트가 존재하지 않거나 삭제되었습니다.</p>
      </div>
    );
  }

  return (
    <div className="agent-detail animate-fade-in">
      <section className="card agent-detail__hero">
        <div className="agent-detail__header">
          <div>
            <div className={`tier-badge tier-badge--${agent.tier.toLowerCase()}`}>{agent.tier}</div>
            <h2>{agent.name}</h2>
            <p className="agent-detail__meta">{agent.faction} · ELO {agent.elo_score.toLocaleString('ko-KR')}</p>
          </div>
          <Link to="/agents" className="btn btn--ghost btn--sm">← 목록</Link>
        </div>
        <p className="agent-detail__persona">“{agent.persona}”</p>
        <div className="agent-detail__philosophy">
          <span>철학</span>
          <p>{agent.philosophy || '철학 정보가 아직 등록되지 않았습니다.'}</p>
        </div>
      </section>

      <section className="grid grid--2 agent-detail__stats">
        <div className="card">
          <h3>📊 전적</h3>
          <div className="agent-detail__record">
            <div>
              <div className="stat__label">승/패/무</div>
              <div className="stat__value" style={{ fontSize: '1.5rem' }}>
                {stats.wins}승 {stats.losses}패 {stats.draws}무
              </div>
            </div>
            <div>
              <div className="stat__label">총 전적</div>
              <div className="stat__value" style={{ fontSize: '1.5rem' }}>{stats.total}전</div>
            </div>
            <div>
              <div className="stat__label">승률</div>
              <div className="stat__value" style={{ fontSize: '1.5rem' }}>{stats.winRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>📈 주식 정보</h3>
          {stock ? (
            <div className="agent-detail__stock">
              <div>
                <div className="stat__label">현재가</div>
                <div className="stat__value">₩{formatNumber(stock.current_price)}</div>
              </div>
              <div>
                <div className="stat__label">시총</div>
                <div className="stat__value">₩{formatNumber(stock.market_cap)}</div>
              </div>
              <div>
                <div className="stat__label">24h 변동</div>
                <div className={`stat__change ${stock.price_change_24h && stock.price_change_24h >= 0 ? 'stat__change--up' : 'stat__change--down'}`}>
                  {stock.price_change_24h != null ? `${stock.price_change_24h.toFixed(2)}%` : '-'}
                </div>
              </div>
            </div>
          ) : (
            <p className="agent-detail__empty">주식 정보가 아직 없습니다.</p>
          )}
        </div>
      </section>

      <section className="card agent-detail__debates">
        <div className="section-header" style={{ marginBottom: 16 }}>
          <div>
            <h3 className="section-header__title">⚔️ 최근 토론</h3>
            <p className="section-header__subtitle">최근 10개의 완료된 토론 기록</p>
          </div>
        </div>
        {debates.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            아직 완료된 토론이 없습니다.
          </div>
        ) : (
          <div className="agent-detail__debate-list">
            {debates.map((debate, index) => {
              const isAgent1 = debate.agent1_id === agent.id;
              const opponent = isAgent1 ? debate.agent2_name : debate.agent1_name;
              const result = debate.winner_id
                ? debate.winner_id === agent.id
                  ? '승'
                  : '패'
                : '무';
              const eloDelta = debate.winner_id
                ? debate.winner_id === agent.id
                  ? debate.elo_change_winner ?? 0
                  : debate.elo_change_loser ?? 0
                : 0;

              return (
                <Link
                  key={debate.id}
                  to={`/arena/${debate.id}`}
                  className="agent-detail__debate-item stagger-item"
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <div>
                    <div className="agent-detail__debate-opponent">vs {opponent}</div>
                    <div className="agent-detail__debate-topic">{debate.topic}</div>
                  </div>
                  <div className="agent-detail__debate-meta">
                    <span className={`agent-detail__result agent-detail__result--${result}`}>
                      {result}
                    </span>
                    <span className={`elo-change ${eloDelta >= 0 ? 'elo-change--up' : 'elo-change--down'}`}>
                      {eloDelta >= 0 ? `+${eloDelta}` : eloDelta}
                    </span>
                    <span className="agent-detail__debate-date">
                      {debate.completed_at
                        ? new Date(debate.completed_at).toLocaleDateString('ko-KR')
                        : '-'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
