import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { streamDebate, type DebateEvent } from '../api.js';
import { useToast } from '../ToastContext.js';

// ─── Types ───
interface AgentInfo {
  id: string;
  name: string;
  faction: string;
  elo: number;
  tier: string;
}

interface ArgumentData {
  round: number;
  agent: 'agent1' | 'agent2';
  name: string;
  text: string;
}

interface DebateResult {
  debateId: string;
  winner: { id: string; name: string; eloChange: number; newElo: number };
  loser: { id: string; name: string; eloChange: number; newElo: number };
  scores: {
    agent1: { logic: number; evidence: number; persuasion: number };
    agent2: { logic: number; evidence: number; persuasion: number };
  };
  reasoning: string;
}

type Phase = 'connecting' | 'matched' | 'debating' | 'judging' | 'result' | 'error';

const FACTION_EMOJI: Record<string, string> = {
  rationalism: '🧠',
  empiricism: '🔬',
  pragmatism: '⚙️',
  idealism: '✨',
  // Fallback for legacy Korean names if any
  '합리주의': '🧠',
  '경험주의': '🔬',
  '실용주의': '⚙️',
  '이상주의': '✨',
};

// ─── Typewriter Hook ───
function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(false); return; }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

// ─── Typing Bubble Component ───
function TypingArgument({ text, agentName, isAgent2 }: { text: string; agentName: string; isAgent2: boolean }) {
  const { displayed, done } = useTypewriter(text, 15);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [displayed]);

  return (
    <div className={`live-bubble ${isAgent2 ? 'live-bubble--right' : 'live-bubble--left'}`}>
      <div className="live-bubble__speaker">
        {isAgent2 ? '🔵' : '🟣'} {agentName}
      </div>
      <div className="live-bubble__text">
        {displayed}
        {!done && <span className="live-cursor">|</span>}
      </div>
      <div ref={endRef} />
    </div>
  );
}

// ─── Score Bar ───
function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="live-score-bar">
      <span className="live-score-bar__label">{label}</span>
      <div className="live-score-bar__track">
        <div className="live-score-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="live-score-bar__value">{value}</span>
    </div>
  );
}

// ─── Main Page ───
export default function LiveDebatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const [phase, setPhase] = useState<Phase>('connecting');
  const [topic, setTopic] = useState('');
  const [agent1, setAgent1] = useState<AgentInfo | null>(null);
  const [agent2, setAgent2] = useState<AgentInfo | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [speakingAgent, setSpeakingAgent] = useState<string | null>(null);
  const [arguments_, setArguments] = useState<ArgumentData[]>([]);
  const [result, setResult] = useState<DebateResult | null>(null);
  const [debateId, setDebateId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const getRoundLabel = useCallback((round: number) => {
    if (round < 1) return '';
    return t(`live_debate.rounds.p${round}`);
  }, [t]);

  const handleEvent = useCallback((event: DebateEvent) => {
    switch (event.type) {
      case 'matched':
        setPhase('matched');
        setTopic(event.data.topic);
        setAgent1(event.data.agent1);
        setAgent2(event.data.agent2);
        setDebateId(event.data.debateId);
        setTimeout(() => setPhase('debating'), 1200);
        break;

      case 'round_start':
        setCurrentRound(event.data.round);
        break;

      case 'speaking':
        setSpeakingAgent(event.data.name);
        break;

      case 'argument':
        setSpeakingAgent(null);
        setArguments(prev => [...prev, event.data as ArgumentData]);
        break;

      case 'judging':
        setPhase('judging');
        break;

      case 'result':
        setResult(event.data as DebateResult);
        setPhase('result');
        break;

      case 'error': {
        let msg = event.data.message || t('common.error');
        if (msg === 'STREAM_READ_FAILED') {
          msg = t('common.stream_read_failed');
        } else if (msg.startsWith('SERVER_ERROR:')) {
          const parts = msg.split(':');
          msg = t('common.server_error', { status: parts[1], message: parts.slice(2).join(':') });
        }
        setErrorMsg(msg);
        setPhase('error');
        pushToast(msg, 'error');
        break;
      }

      case 'complete':
        break;
    }
  }, [pushToast, t]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    streamDebate(handleEvent, controller.signal);

    return () => {
      controller.abort();
    };
  }, [handleEvent]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [arguments_]);

  // ─── Render: Connecting ───
  if (phase === 'connecting') {
    return (
      <div className="live-page">
        <div className="live-center-msg animate-pulse-slow">
          <div className="live-swords">⚔️</div>
          <h2>{t('live_debate.matching.title')}</h2>
          <p>{t('live_debate.matching.subtitle')}</p>
          <div className="spinner" style={{ width: 32, height: 32, margin: '16px auto' }} />
        </div>
      </div>
    );
  }

  // ─── Render: Matched ───
  if (phase === 'matched' && agent1 && agent2) {
    return (
      <div className="live-page">
        <div className="live-matchup animate-scale-in">
          <div className="live-matchup__agent">
            <div className="live-matchup__tier">{agent1.tier}</div>
            <h3>{FACTION_EMOJI[agent1.faction] || '🤖'} {agent1.name}</h3>
            <span>ELO {agent1.elo}</span>
          </div>
          <div className="live-matchup__vs">⚔️</div>
          <div className="live-matchup__agent">
            <div className="live-matchup__tier">{agent2.tier}</div>
            <h3>{FACTION_EMOJI[agent2.faction] || '🤖'} {agent2.name}</h3>
            <span>ELO {agent2.elo}</span>
          </div>
          <div className="live-matchup__topic">{topic}</div>
        </div>
      </div>
    );
  }

  // ─── Render: Error ───
  if (phase === 'error') {
    return (
      <div className="live-page">
        <div className="live-center-msg">
          <div style={{ fontSize: '3rem' }}>❌</div>
          <h2>{t('live_debate.error.title')}</h2>
          <p>{errorMsg}</p>
          <button className="btn btn--primary" onClick={() => navigate('/arena')} style={{ marginTop: 16 }}>
            {t('live_debate.error.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="live-page">
      {/* Header */}
      <div className="live-header">
        <div className="live-header__agents">
          <span className="live-header__agent live-header__agent--1">
            {FACTION_EMOJI[agent1?.faction || ''] || '🟣'} {agent1?.name}
          </span>
          <span className="live-header__vs">vs</span>
          <span className="live-header__agent live-header__agent--2">
            {FACTION_EMOJI[agent2?.faction || ''] || '🔵'} {agent2?.name}
          </span>
        </div>
        <div className="live-header__topic">{topic}</div>
        <div className="live-header__round">
          {phase === 'judging'
            ? t('live_debate.status.judging')
            : phase === 'result'
              ? t('live_debate.status.result')
              : `${t('live_debate.rounds.round', { current: currentRound, total: 3 })} · ${getRoundLabel(currentRound)}`}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="live-progress">
        {[1, 2, 3].map(r => (
          <div
            key={r}
            className={`live-progress__step ${r < currentRound ? 'done' : ''} ${r === currentRound ? 'active' : ''}`}
          >
            <span>{getRoundLabel(r)}</span>
          </div>
        ))}
        <div className={`live-progress__step ${phase === 'judging' || phase === 'result' ? 'active' : ''}`}>
          <span>{t('live_debate.judging.label')}</span>
        </div>
      </div>

      {/* Content */}
      <div className="live-content" ref={contentRef}>
        {arguments_.map((arg, i) => (
          <TypingArgument
            key={`${arg.round}-${arg.agent}-${i}`}
            text={arg.text}
            agentName={arg.name}
            isAgent2={arg.agent === 'agent2'}
          />
        ))}

        {speakingAgent && phase === 'debating' && (
          <div className="live-typing-indicator animate-fade-in">
            <div className="live-typing-dots">
              <span /><span /><span />
            </div>
            <span>{t('live_debate.status.preparing', { name: speakingAgent })}</span>
          </div>
        )}

        {phase === 'judging' && (
          <div className="live-judging animate-fade-in">
            <div className="live-swords">⚖️</div>
            <h3>{t('live_debate.judging.title')}</h3>
            <div className="spinner" style={{ width: 24, height: 24, margin: '8px auto' }} />
          </div>
        )}

        {/* Result */}
        {phase === 'result' && result && (
          <div className="live-result animate-scale-in">
            <h3 className="live-result__title">{t('live_debate.result.title')}</h3>

            <div className="live-result__winner">
              <div className="live-result__label">{t('live_debate.result.winner')}</div>
              <div className="live-result__name">{result.winner.name}</div>
              <div className="elo-change elo-change--up">+{result.winner.eloChange} ELO → {result.winner.newElo}</div>
            </div>

            <div className="live-result__loser">
              <div className="live-result__label">{t('live_debate.result.loser')}</div>
              <div className="live-result__name">{result.loser.name}</div>
              <div className="elo-change elo-change--down">{result.loser.eloChange} ELO → {result.loser.newElo}</div>
            </div>

            <div className="live-result__scores">
              <div>
                <h4>{agent1?.name}</h4>
                <ScoreBar label={t('live_debate.result.scores.logic')} value={result.scores.agent1.logic} />
                <ScoreBar label={t('live_debate.result.scores.evidence')} value={result.scores.agent1.evidence} />
                <ScoreBar label={t('live_debate.result.scores.persuasion')} value={result.scores.agent1.persuasion} />
              </div>
              <div>
                <h4>{agent2?.name}</h4>
                <ScoreBar label={t('live_debate.result.scores.logic')} value={result.scores.agent2.logic} />
                <ScoreBar label={t('live_debate.result.scores.evidence')} value={result.scores.agent2.evidence} />
                <ScoreBar label={t('live_debate.result.scores.persuasion')} value={result.scores.agent2.persuasion} />
              </div>
            </div>

            <div className="live-result__reasoning">
              <div className="live-result__reasoning-label">{t('live_debate.result.reasoning')}</div>
              <p>{result.reasoning}</p>
            </div>

            <div className="live-result__actions">
              <button className="btn btn--primary" onClick={() => navigate(`/arena/${debateId}`)}>
                {t('live_debate.actions.view_full')}
              </button>
              <button className="btn btn--secondary" onClick={() => window.location.reload()}>
                {t('live_debate.actions.new_debate')}
              </button>
              <button className="btn btn--ghost" onClick={() => navigate('/arena')}>
                {t('live_debate.actions.back_to_arena')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
