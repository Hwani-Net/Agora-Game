import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDebateById } from '../api.js';
import { useToast } from '../ToastContext.js';

type DebateRound = {
  round: number;
  agent1_argument?: string;
  agent2_argument?: string;
  agent1_score?: number;
  agent2_score?: number;
};

type DebateDetail = {
  id: string;
  topic: string;
  agent1_name: string;
  agent2_name: string;
  agent1_id: string;
  agent2_id: string;
  rounds: unknown;
  judge_reasoning?: string;
  winner_id?: string | null;
  winner_name?: string | null;
  elo_change_winner?: number | null;
  elo_change_loser?: number | null;
};

const ROUND_TITLES: Record<number, string> = {
  1: '주장',
  2: '반박',
  3: '최종 변론',
};

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const nextValue = Math.round(target * progress);
      setValue(nextValue);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    setValue(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

export default function DebateDetailPage() {
  const { debateId } = useParams();
  const { pushToast } = useToast();
  const [debate, setDebate] = useState<DebateDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!debateId) return;
    let active = true;
    setLoading(true);
    getDebateById(debateId)
      .then((data) => {
        if (!active) return;
        setDebate(data as DebateDetail);
      })
      .catch((err) => {
        if (!active) return;
        pushToast(err instanceof Error ? err.message : '토론 정보를 불러오지 못했습니다.', 'error');
        setDebate(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debateId, pushToast]);

  const rounds = useMemo(() => {
    if (!debate?.rounds) return [] as DebateRound[];
    try {
      const parsed = typeof debate.rounds === 'string' ? JSON.parse(debate.rounds) : debate.rounds;
      return Array.isArray(parsed) ? (parsed as DebateRound[]) : [];
    } catch {
      return [] as DebateRound[];
    }
  }, [debate]);

  const winnerName = debate?.winner_name || '';
  const loserName = debate
    ? debate.winner_id === debate.agent1_id
      ? debate.agent2_name
      : debate.winner_id === debate.agent2_id
        ? debate.agent1_name
        : ''
    : '';

  const winnerElo = debate?.elo_change_winner ?? 0;
  const loserElo = debate?.elo_change_loser ?? 0;
  const winnerEloAnimated = useCountUp(winnerElo);
  const loserEloAnimated = useCountUp(loserElo);

  if (loading) {
    return (
      <div className="debate-detail">
        <div className="card skeleton" style={{ height: 180, marginBottom: 24 }} />
        <div className="card skeleton" style={{ height: 240, marginBottom: 24 }} />
        <div className="card skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!debate) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📭</div>
        <div className="empty-state__title">토론을 찾을 수 없습니다</div>
        <p>요청하신 토론이 존재하지 않거나 삭제되었습니다.</p>
      </div>
    );
  }

  return (
    <div className="debate-detail animate-fade-in">
      <section className="card debate-detail__hero">
        <div className="debate-detail__topic">토론 주제</div>
        <h2 className="debate-detail__title">{debate.topic}</h2>
        <div className="debate-detail__agents">
          <span>{debate.agent1_name}</span>
          <span className="debate-detail__vs">⚔️</span>
          <span>{debate.agent2_name}</span>
        </div>
      </section>

      <section className="debate-detail__rounds">
        {rounds.length === 0 ? (
          <div className="card empty-state">라운드 기록이 아직 준비되지 않았습니다.</div>
        ) : (
          rounds.map((round, index) => (
            <div key={`${round.round}-${index}`} className="card debate-round stagger-item" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="debate-round__header">
                <div className="debate-round__label">
                  라운드 {round.round}: {ROUND_TITLES[round.round] || '토론'}
                </div>
                {(round.agent1_score != null || round.agent2_score != null) && (
                  <div className="debate-round__score">
                    <span>{round.agent1_score ?? '-'} 점</span>
                    <span>:</span>
                    <span>{round.agent2_score ?? '-'} 점</span>
                  </div>
                )}
              </div>
              <div className="debate-round__grid">
                <div>
                  <div className="debate-round__speaker">🟣 {debate.agent1_name}</div>
                  <div className="debate-round__text">{round.agent1_argument || '발언이 없습니다.'}</div>
                </div>
                <div>
                  <div className="debate-round__speaker">🔵 {debate.agent2_name}</div>
                  <div className="debate-round__text">{round.agent2_argument || '발언이 없습니다.'}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card debate-detail__result">
        <h3>🏆 판정 결과</h3>
        {winnerName ? (
          <div className="debate-detail__result-grid">
            <div>
              <div className="debate-detail__result-label">승자</div>
              <div className="debate-detail__result-value">
                {winnerName}
                <span className="elo-change elo-change--up">
                  {winnerEloAnimated >= 0 ? `+${winnerEloAnimated}` : winnerEloAnimated}
                </span>
              </div>
            </div>
            <div>
              <div className="debate-detail__result-label">패자</div>
              <div className="debate-detail__result-value">
                {loserName}
                <span className="elo-change elo-change--down">{loserEloAnimated}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="debate-detail__pending">아직 판정이 완료되지 않았습니다.</p>
        )}
        <div className="debate-detail__reason">
          <div className="debate-detail__reason-label">판정 이유</div>
          <p>{debate.judge_reasoning || '판정 사유가 제공되지 않았습니다.'}</p>
        </div>
      </section>
    </div>
  );
}
