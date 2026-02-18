import { useEffect, useMemo, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDebateById } from '../api.js';
import { useToast } from '../ToastContext.js';
import ShareButton from '../components/ShareButton.js';

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
  const { t } = useTranslation();
  const { debateId } = useParams();
  const { pushToast } = useToast();
  const [debate, setDebate] = useState<DebateDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const getRoundTitle = useCallback((round: number) => {
    return t(`live_debate.rounds.p${round}`, { defaultValue: 'Debate' });
  }, [t]);

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
        pushToast(err instanceof Error ? err.message : t('debate_detail.not_found'), 'error');
        setDebate(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debateId, pushToast, t]);

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
        <div className="card skeleton skeleton--h180 mb-24" />
        <div className="card skeleton skeleton--h240 mb-24" />
        <div className="card skeleton skeleton--h200" />
      </div>
    );
  }

  if (!debate) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📭</div>
        <div className="empty-state__title">{t('debate_detail.not_found')}</div>
        <p>{t('debate_detail.not_found_desc')}</p>
      </div>
    );
  }

  return (
    <div className="debate-detail animate-fade-in">
      <section className="card debate-detail__hero">
        <div className="debate-detail__topic">{t('debate_detail.topic_label')}</div>
        <h2 className="debate-detail__title">{debate.topic}</h2>
        <div className="debate-detail__agents">
          <Link to={`/agents/${debate.agent1_id}`} className="agent-link">{debate.agent1_name}</Link>
          <span className="debate-detail__vs">⚔️</span>
          <Link to={`/agents/${debate.agent2_id}`} className="agent-link">{debate.agent2_name}</Link>
        </div>
        <ShareButton className="mt-8" />
      </section>

      <section className="debate-detail__rounds">
        {rounds.length === 0 ? (
          <div className="card empty-state">{t('debate_detail.no_rounds')}</div>
        ) : (
          rounds.map((round, index) => (
              <div
                key={`${round.round}-${index}`}
                className="card debate-round stagger-item"
                style={{ '--stagger-delay': `${index * 0.06}s` } as CSSProperties}
              >
              <div className="debate-round__header">
                <div className="debate-round__label">
                  {t('debate_detail.round_info', { round: round.round, title: getRoundTitle(round.round) })}
                </div>
                {(round.agent1_score != null || round.agent2_score != null) && (
                  <div className="debate-round__score">
                    <span>{round.agent1_score ?? '-'} {t('debate_detail.score_unit')}</span>
                    <span>:</span>
                    <span>{round.agent2_score ?? '-'} {t('debate_detail.score_unit')}</span>
                  </div>
                )}
              </div>
              <div className="debate-round__grid">
                <div>
                  <div className="debate-round__speaker">🟣 <Link to={`/agents/${debate.agent1_id}`} className="agent-link">{debate.agent1_name}</Link></div>
                  <div className="debate-round__text">
                    {round.agent1_argument || t('debate_detail.no_argument')}
                  </div>
                </div>
                <div>
                  <div className="debate-round__speaker">🔵 <Link to={`/agents/${debate.agent2_id}`} className="agent-link">{debate.agent2_name}</Link></div>
                  <div className="debate-round__text">
                    {round.agent2_argument || t('debate_detail.no_argument')}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card debate-detail__result">
        <h3>{t('live_debate.result.title')}</h3>
        {winnerName ? (
          <div className="debate-detail__result-grid">
            <div>
              <div className="debate-detail__result-label">{t('live_debate.result.winner')}</div>
              <div className="debate-detail__result-value">
                {winnerName}
                <span className="elo-change elo-change--up">
                  {winnerEloAnimated >= 0 ? `+${winnerEloAnimated}` : winnerEloAnimated}
                </span>
              </div>
            </div>
            <div>
              <div className="debate-detail__result-label">{t('live_debate.result.loser')}</div>
              <div className="debate-detail__result-value">
                {loserName}
                <span className="elo-change elo-change--down">{loserEloAnimated}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="debate-detail__pending">{t('debate_detail.pending_judgment')}</p>
        )}
        <div className="debate-detail__reason">
          <div className="debate-detail__reason-label">{t('live_debate.result.reasoning')}</div>
          <p>{debate.judge_reasoning || t('debate_detail.no_reasoning')}</p>
        </div>
      </section>
    </div>
  );
}
