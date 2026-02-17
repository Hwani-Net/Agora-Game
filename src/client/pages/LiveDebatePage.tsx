import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

const ROUND_LABELS: Record<number, string> = { 1: '주장', 2: '반박', 3: '최종 변론' };
const FACTION_EMOJI: Record<string, string> = {
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

  const handleEvent = useCallback((event: DebateEvent) => {
    switch (event.type) {
      case 'matched':
        setPhase('matched');
        setTopic(event.data.topic);
        setAgent1(event.data.agent1);
        setAgent2(event.data.agent2);
        setDebateId(event.data.debateId);
        // Brief pause to show match, then transition
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

      case 'error':
        setErrorMsg(event.data.message || '알 수 없는 오류');
        setPhase('error');
        pushToast(event.data.message || '토론 실행 오류', 'error');
        break;

      case 'complete':
        break;
    }
  }, [pushToast]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    streamDebate(handleEvent, controller.signal);

    return () => {
      controller.abort();
    };
  }, [handleEvent]);

  // Auto-scroll to bottom as new arguments appear
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
          <h2>AI 에이전트 매칭 중...</h2>
          <p>실력이 비슷한 두 AI를 찾고 있습니다</p>
          <div className="spinner" style={{ width: 32, height: 32, margin: '16px auto' }} />
        </div>
      </div>
    );
  }

  // ─── Render: Matched (brief flash) ───
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
          <h2>오류 발생</h2>
          <p>{errorMsg}</p>
          <button className="btn btn--primary" onClick={() => navigate('/arena')} style={{ marginTop: 16 }}>
            아레나로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Active Debate / Judging / Result ───
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
          {phase === 'judging' ? '⚖️ 판정 중' : phase === 'result' ? '🏆 결과' : `라운드 ${currentRound}/3 · ${ROUND_LABELS[currentRound] || ''}`}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="live-progress">
        {[1, 2, 3].map(r => (
          <div
            key={r}
            className={`live-progress__step ${r < currentRound ? 'done' : ''} ${r === currentRound ? 'active' : ''}`}
          >
            <span>{ROUND_LABELS[r]}</span>
          </div>
        ))}
        <div className={`live-progress__step ${phase === 'judging' || phase === 'result' ? 'active' : ''}`}>
          <span>판정</span>
        </div>
      </div>

      {/* Chat-style debate content */}
      <div className="live-content" ref={contentRef}>
        {arguments_.map((arg, i) => (
          <TypingArgument
            key={`${arg.round}-${arg.agent}-${i}`}
            text={arg.text}
            agentName={arg.name}
            isAgent2={arg.agent === 'agent2'}
          />
        ))}

        {/* Speaking indicator */}
        {speakingAgent && phase === 'debating' && (
          <div className="live-typing-indicator animate-fade-in">
            <div className="live-typing-dots">
              <span /><span /><span />
            </div>
            <span>{speakingAgent}이(가) 발언 준비 중...</span>
          </div>
        )}

        {/* Judging */}
        {phase === 'judging' && (
          <div className="live-judging animate-fade-in">
            <div className="live-swords">⚖️</div>
            <h3>AI 심판이 판정 중...</h3>
            <div className="spinner" style={{ width: 24, height: 24, margin: '8px auto' }} />
          </div>
        )}

        {/* Result */}
        {phase === 'result' && result && (
          <div className="live-result animate-scale-in">
            <h3 className="live-result__title">🏆 판정 결과</h3>

            <div className="live-result__winner">
              <div className="live-result__label">승자</div>
              <div className="live-result__name">{result.winner.name}</div>
              <div className="elo-change elo-change--up">+{result.winner.eloChange} ELO → {result.winner.newElo}</div>
            </div>

            <div className="live-result__loser">
              <div className="live-result__label">패자</div>
              <div className="live-result__name">{result.loser.name}</div>
              <div className="elo-change elo-change--down">{result.loser.eloChange} ELO → {result.loser.newElo}</div>
            </div>

            <div className="live-result__scores">
              <div>
                <h4>{agent1?.name}</h4>
                <ScoreBar label="논리" value={result.scores.agent1.logic} />
                <ScoreBar label="근거" value={result.scores.agent1.evidence} />
                <ScoreBar label="설득" value={result.scores.agent1.persuasion} />
              </div>
              <div>
                <h4>{agent2?.name}</h4>
                <ScoreBar label="논리" value={result.scores.agent2.logic} />
                <ScoreBar label="근거" value={result.scores.agent2.evidence} />
                <ScoreBar label="설득" value={result.scores.agent2.persuasion} />
              </div>
            </div>

            <div className="live-result__reasoning">
              <div className="live-result__reasoning-label">판정 이유</div>
              <p>{result.reasoning}</p>
            </div>

            <div className="live-result__actions">
              <button className="btn btn--primary" onClick={() => navigate(`/arena/${debateId}`)}>
                📜 토론 전문 보기
              </button>
              <button className="btn btn--secondary" onClick={() => window.location.reload()}>
                🔄 새 토론 시작
              </button>
              <button className="btn btn--ghost" onClick={() => navigate('/arena')}>
                ← 아레나
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
