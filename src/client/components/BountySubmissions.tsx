import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchBountySubmissions, triggerBountyResponse, awardBounty } from '../api.js';
import { useToast } from '../ToastContext.js';

interface Submission {
  id: string;
  answer_content: string;
  votes: number;
  agent_id: string;
  agents: {
    name: string;
    faction: string;
    elo_score: number;
  };
}

interface Props {
  questId: string;
  isOwner: boolean;
  onUpdate: () => void;
}

export default function BountySubmissions({ questId, isOwner, onUpdate }: Props) {
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [awarding, setAwarding] = useState<string | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, [questId]);

  async function loadSubmissions() {
    setLoading(true);
    try {
      const data = await fetchBountySubmissions(questId);
      setSubmissions(data as Submission[]);
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    try {
      await triggerBountyResponse(questId);
      pushToast('AI 에이전트가 답변을 생성했습니다.', 'success');
      loadSubmissions();
    } catch {
      pushToast('답변 생성 실패', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAward(subId: string) {
    if (awarding) return;
    setAwarding(subId);
    try {
      await awardBounty(questId, subId);
      pushToast('현상금이 지급되었습니다!', 'success');
      onUpdate();
    } catch {
      pushToast('현상금 지급 실패', 'error');
    } finally {
      setAwarding(null);
    }
  }

  if (loading && submissions.length === 0) {
    return <div className="spinner spinner--sm spinner--center" />;
  }

  return (
    <div className="bounty-submissions mt-16">
      <div className="section-header">
        <h4 className="section-header__title">{t('quests.bounty_responses', { count: submissions.length })}</h4>
        {submissions.length < 3 && !isOwner && (
          <button className="btn btn--secondary btn--xs" onClick={handleGenerate} disabled={generating}>
            {generating ? '생성 중...' : '답변 요청 ⚡'}
          </button>
        )}
      </div>

      {submissions.length === 0 ? (
        <p className="text-sm-muted p-y-12">아직 응답한 에이전트가 없습니다.</p>
      ) : (
        <div className="submissions-list">
          {submissions.map((sub) => (
            <div key={sub.id} className="submission-card card mb-12">
              <div className="submission-card__header">
                <div className="agent-mini-info">
                  <span className="text-bold">{sub.agents.name}</span>
                  <span className="badge badge--sm">{sub.agents.faction}</span>
                  <span className="elo-tag">ELO {sub.agents.elo_score}</span>
                </div>
                {isOwner && (
                  <button 
                    className="btn btn--primary btn--xs" 
                    onClick={() => handleAward(sub.id)}
                    disabled={!!awarding}
                  >
                    {awarding === sub.id ? '지급 중...' : '🏆 현상금 지급'}
                  </button>
                )}
              </div>
              <div className="submission-card__content mt-8 text-sm">
                {sub.answer_content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
