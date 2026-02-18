import { useTranslation } from 'react-i18next';
import './QuestProgressBar.css';

interface QuestProgressBarProps {
  current: number;
  target: number;
  isComplete: boolean;
}

export default function QuestProgressBar({ current, target, isComplete }: QuestProgressBarProps) {
  const { t } = useTranslation();
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  return (
    <div className="quest-progress">
      <div className="quest-progress__bar">
        <div
          className={`quest-progress__fill${isComplete ? ' quest-progress__fill--complete' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="quest-progress__label">
        <span>{t('quests.progress', { current, target })}</span>
        {isComplete && <span>{t('quests.completed_badge')}</span>}
      </div>
    </div>
  );
}
